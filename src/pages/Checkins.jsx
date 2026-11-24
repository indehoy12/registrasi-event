import { useMemo, useState } from 'react'
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { Badge, Empty, useDialog, Skel, SkelRows } from '../ui'
import { useColState, useSeminar, fmt, showCode, hariList, hariLabel, ckDay, cariCocok, urutRiwayat, batalkanCheckin } from '../hooks'

export default function Checkins({ canEdit }) {
  const ask = useDialog(), [raw, lc] = useColState('checkins'), [ts, lt] = useColState('tickets'), [pp, lpp] = useColState('participants'), loading = lc || lt || lpp
  const usaha = useMemo(() => Object.fromEntries(ts.map(t => [t.id, t.institution || ''])), [ts]), inst = (c) => usaha[c.ticketId] || c.institution || '', surel = useMemo(() => Object.fromEntries(pp.map(p => [p.id, p.email || ''])), [pp]), email = (c) => surel[c.participantId] || ''
  const { sem } = useSeminar(), days = hariList(sem), multi = days.length > 1, cs = useMemo(() => [...raw].sort(urutRiwayat(days)), [raw, days.join()]), [hf, setHf] = useState('semua')
  const [q, setQ] = useState(''), [f, setF] = useState('semua'), [ed, setEd] = useState(null), [msg, setMsg] = useState('')
  const log = (action, c) => addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action, participant: c.participantName }).catch(() => {})
  const list = cs.filter(c => (hf === 'semua' || ckDay(c, days) === hf) && (f === 'semua' || (f === 'wakil') === !!c.isRepresentative)
    && cariCocok(q.trim(), [fmt(c.checkedInAt), multi ? hariLabel(days, ckDay(c, days)) : '', c.participantName, inst(c), email(c), c.isRepresentative ? 'Perwakilan' : 'Peserta', c.representativeName, c.via === 'manual' ? 'Manual' : 'QR', c.officerEmail].join(' '), showCode(c.ticketId)))

  const undo = async (c) => {
    if (!await ask({ title: 'Batalkan check-in?', text: `Check-in ${c.participantName} akan dibatalkan.`, ok: 'Batalkan check-in', danger: true, icon: 'arrow-counterclockwise' })) return
    try { await batalkanCheckin(c, ckDay(c, days)); log('batalkan check-in', c); setMsg(`Check-in ${c.participantName} dibatalkan.`)
    } catch (e) { setMsg('Gagal membatalkan: ' + (e.code === 'permission-denied' ? 'akses ditolak.' : e.message)) } }

  const saveEdit = async (e) => { e.preventDefault()
    const name = ed.who === 'wakil' ? ed.name.trim() : ''; if (ed.who === 'wakil' && !name) return
    try { await updateDoc(doc(db, 'checkins', ed.c.id), { isRepresentative: !!name, representativeName: name || null })
      log('ubah data kehadiran', ed.c); setMsg('Data kehadiran diperbarui.'); setEd(null)
    } catch (er) { setMsg('Gagal menyimpan: ' + (er.code === 'permission-denied' ? 'akses ditolak.' : er.message)); setEd(null) } }

  const Chip = ({ k, l }) => <button className={`btn btn-sm ${f === k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setF(k)}>{l}</button>
  return <>
    <h1 className="h4">Riwayat kehadiran ({loading ? <Skel w="2rem" h="1rem" className="align-middle"/> : cs.length})</h1>
    {msg && <div className="alert alert-info" role="status">{msg}</div>}
    <div className="d-flex gap-2 flex-wrap mb-2"><input className="form-control" style={{ maxWidth: 360 }} aria-label="Cari riwayat kehadiran" placeholder="Cari nama PIC, perusahaan, atau email" type="search" autoComplete="off" value={q} onChange={e => setQ(e.target.value)}/>
      {!loading && q.trim() && <span className="small text-muted align-self-center" role="status" aria-live="polite">{list.length} dari {cs.length} data</span>}
      {multi && <div className="d-flex gap-1"><button className={`btn btn-sm ${hf === 'semua' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setHf('semua')}>Semua hari</button>{days.map(d => <button key={d} className={`btn btn-sm ${hf === d ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setHf(d)}>{hariLabel(days, d)}</button>)}</div>}
      <div className="d-flex gap-1"><Chip k="semua" l="Semua"/><Chip k="sendiri" l="Peserta sendiri"/><Chip k="wakil" l="Perwakilan"/></div></div>
    <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th style={{ width: '3rem' }}>No</th><th>Waktu</th>{multi && <th>Hari</th>}<th>Nama PIC/Admin</th><th>Nama Perusahaan/Nama Individu</th><th>Email Address</th><th>No. undangan</th><th>Hadir sebagai</th><th>Nama perwakilan</th><th>Cara</th><th>Petugas</th>{canEdit && <th/>}</tr></thead><tbody>
      {loading && <SkelRows rows={6} cols={(canEdit ? 11 : 10) + (multi ? 1 : 0)}/>}
      {!loading && list.map((c, i) => <tr key={c.id}><td className="text-muted">{i + 1}</td><td>{fmt(c.checkedInAt)}</td>{multi && <td>{hariLabel(days, ckDay(c, days))}</td>}<td>{c.participantName}</td><td>{inst(c) || <span className="text-muted">-</span>}</td><td className="small">{email(c) || <span className="text-muted">-</span>}</td><td className="tk-code">{showCode(c.ticketId)}</td><td><Badge s={c.isRepresentative ? 'perwakilan' : 'peserta'}/></td><td>{c.representativeName || '-'}</td><td>{c.via === 'manual' ? 'Manual' : 'QR'}</td><td>{c.officerEmail}</td>
        {canEdit && <td className="text-end text-nowrap"><button className="btn btn-link btn-sm" onClick={() => setEd({ c, who: c.isRepresentative ? 'wakil' : 'sendiri', name: c.representativeName || '' })}>Ubah</button>
          <button className="btn btn-link btn-sm text-danger" onClick={() => undo(c)}>Batalkan</button></td>}</tr>)}
      {!loading && !list.length && <tr><td colSpan="13"><Empty icon="clock-history" text={cs.length ? 'Tidak ada data yang cocok.' : 'Belum ada yang check-in.'}/></td></tr>}</tbody></table></div>
    {ed && <div className="mdl-back" onMouseDown={e => e.target === e.currentTarget && setEd(null)}><form className="mdl" onSubmit={saveEdit} role="dialog" aria-modal="true" aria-labelledby="ed-t">
      <h2 id="ed-t" className="h5 mb-1">Ubah data kehadiran</h2><p className="text-muted">{ed.c.participantName}</p>
      <div className="who mb-3"><button type="button" className={ed.who === 'sendiri' ? 'on' : ''} onClick={() => setEd({ ...ed, who: 'sendiri' })}><i className="bi bi-person-check"/>Peserta sendiri</button>
        <button type="button" className={ed.who === 'wakil' ? 'on' : ''} onClick={() => setEd({ ...ed, who: 'wakil' })}><i className="bi bi-person-badge"/>Diwakilkan</button></div>
      {ed.who === 'wakil' && <><label className="form-label" htmlFor="en">Nama perwakilan</label><input id="en" className="form-control mb-3" autoFocus value={ed.name} onChange={e => setEd({ ...ed, name: e.target.value })}/></>}
      <div className="mdl-act"><button type="button" className="btn btn-outline-secondary" onClick={() => setEd(null)}>Batal</button><button className="btn btn-primary" disabled={ed.who === 'wakil' && !ed.name.trim()}>Simpan</button></div></form></div>}
  </>
}
