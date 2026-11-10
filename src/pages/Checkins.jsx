import { useState } from 'react'
import { addDoc, collection, deleteField, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { Badge, Empty, useDialog, Skel, SkelRows } from '../ui'
import { useColState, fmt, showCode } from '../hooks'

export default function Checkins({ canEdit }) {
  const ask = useDialog(), [cs, loading] = useColState('checkins', 'checkedInAt')
  const [q, setQ] = useState(''), [f, setF] = useState('semua'), [ed, setEd] = useState(null), [msg, setMsg] = useState('')
  const log = (action, c) => addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action, participant: c.participantName }).catch(() => {})
  const list = cs.filter(c => (f === 'semua' || (f === 'wakil') === !!c.isRepresentative)
    && (c.participantName + ' ' + (c.representativeName || '') + ' ' + (c.ticketCode || '')).toLowerCase().includes(q.trim().toLowerCase()))

  const undo = async (c) => {
    if (!await ask({ title: 'Batalkan check-in?', text: `Check-in ${c.participantName} dihapus dan tiketnya bisa dipakai lagi. Gunakan ini jika petugas salah memproses.`, ok: 'Batalkan check-in', danger: true, icon: 'arrow-counterclockwise' })) return
    try { const b = writeBatch(db)
      b.delete(doc(db, 'checkins', c.id)); b.update(doc(db, 'tickets', c.ticketId), { status: 'aktif', usedAt: deleteField(), usedBy: deleteField() })
      await b.commit(); log('batalkan check-in', c); setMsg(`Check-in ${c.participantName} dibatalkan.`)
    } catch (e) { setMsg('Gagal membatalkan: ' + (e.code === 'permission-denied' ? 'ditolak oleh Firestore Rules (publish firestore.rules terbaru).' : e.message)) } }

  const saveEdit = async (e) => { e.preventDefault()
    const name = ed.who === 'wakil' ? ed.name.trim() : ''; if (ed.who === 'wakil' && !name) return
    try { await updateDoc(doc(db, 'checkins', ed.c.id), { isRepresentative: !!name, representativeName: name || null })
      log('ubah data kehadiran', ed.c); setMsg('Data kehadiran diperbarui.'); setEd(null)
    } catch (er) { setMsg('Gagal menyimpan: ' + (er.code === 'permission-denied' ? 'ditolak oleh Firestore Rules (publish firestore.rules terbaru).' : er.message)); setEd(null) } }

  const Chip = ({ k, l }) => <button className={`btn btn-sm ${f === k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setF(k)}>{l}</button>
  return <>
    <h1 className="h4">Riwayat kehadiran ({loading ? <Skel w="2rem" h="1rem" className="align-middle"/> : cs.length})</h1>
    <p className="sub">Daftar semua peserta yang sudah check-in, terbaru di atas.{canEdit ? ' Salah input? Gunakan Ubah atau Batalkan.' : ''}</p>
    {msg && <div className="alert alert-info" role="status">{msg}</div>}
    <div className="d-flex gap-2 flex-wrap mb-2"><input className="form-control" style={{ maxWidth: 320 }} placeholder="Cari nama, perwakilan, atau nomor tiket (langsung muncul)" type="search" autoComplete="off" value={q} onChange={e => setQ(e.target.value)}/>
      <div className="d-flex gap-1"><Chip k="semua" l="Semua"/><Chip k="sendiri" l="Peserta sendiri"/><Chip k="wakil" l="Perwakilan"/></div></div>
    <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Waktu</th><th>Peserta</th><th>No. tiket</th><th>Hadir sebagai</th><th>Nama perwakilan</th><th>Cara</th><th>Petugas</th>{canEdit && <th/>}</tr></thead><tbody>
      {loading && <SkelRows rows={6} cols={canEdit ? 8 : 7}/>}
      {!loading && list.map(c => <tr key={c.id}><td>{fmt(c.checkedInAt)}</td><td>{c.participantName}</td><td className="tk-code">{showCode(c.ticketId)}</td><td><Badge s={c.isRepresentative ? 'perwakilan' : 'peserta'}/></td><td>{c.representativeName || '-'}</td><td>{c.via === 'manual' ? 'Manual' : 'QR'}</td><td>{c.officerEmail}</td>
        {canEdit && <td className="text-end text-nowrap"><button className="btn btn-link btn-sm" onClick={() => setEd({ c, who: c.isRepresentative ? 'wakil' : 'sendiri', name: c.representativeName || '' })}>Ubah</button>
          <button className="btn btn-link btn-sm text-danger" onClick={() => undo(c)}>Batalkan</button></td>}</tr>)}
      {!loading && !list.length && <tr><td colSpan="8"><Empty icon="clock-history" text={cs.length ? 'Tidak ada data yang cocok.' : 'Belum ada yang check-in.'}/></td></tr>}</tbody></table></div>
    {ed && <div className="mdl-back" onMouseDown={e => e.target === e.currentTarget && setEd(null)}><form className="mdl" onSubmit={saveEdit} role="dialog" aria-modal="true" aria-labelledby="ed-t">
      <h2 id="ed-t" className="h5 mb-1">Ubah data kehadiran</h2><p className="text-muted">{ed.c.participantName}</p>
      <div className="who mb-3"><button type="button" className={ed.who === 'sendiri' ? 'on' : ''} onClick={() => setEd({ ...ed, who: 'sendiri' })}><i className="bi bi-person-check"/>Peserta sendiri</button>
        <button type="button" className={ed.who === 'wakil' ? 'on' : ''} onClick={() => setEd({ ...ed, who: 'wakil' })}><i className="bi bi-person-badge"/>Diwakilkan</button></div>
      {ed.who === 'wakil' && <><label className="form-label" htmlFor="en">Nama perwakilan</label><input id="en" className="form-control mb-3" autoFocus value={ed.name} onChange={e => setEd({ ...ed, name: e.target.value })}/></>}
      <div className="mdl-act"><button type="button" className="btn btn-outline-secondary" onClick={() => setEd(null)}>Batal</button><button className="btn btn-primary" disabled={ed.who === 'wakil' && !ed.name.trim()}>Simpan</button></div></form></div>}
  </>
}
