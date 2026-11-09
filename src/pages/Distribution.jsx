import { useDialog, SkelRows, MapsWarn, Skel } from '../ui'
import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useColState, useSeminar, wait, sendTicketWA } from '../hooks'; import { auth, db } from '../firebase'
export default function Distribution() {
  const ask = useDialog()
  const [ps, lp] = useColState('participants'), [ts, lt] = useColState('tickets'), loading = lp || lt, { loaded: sl, mapsOk } = useSeminar(), by = Object.fromEntries(ts.filter(t => t.status === 'aktif').map(t => [t.participantId, t]))
  const [state, setState] = useState({}), [busy, setBusy] = useState(false), [info, setInfo] = useState('')
  const one = async (p, t) => { setState(s => ({ ...s, [p.id]: 'Mengirim…' }))
    try { const j = await sendTicketWA(t.id); setState(s => ({ ...s, [p.id]: j.via === 'fonnte-gambar' ? 'Terkirim (gambar QR)' : `Terkirim (tautan saja${j.note ? '; gambar ditolak: ' + j.note : ''})` })); return true } catch (e) { setState(s => ({ ...s, [p.id]: e.message })); return false } }
  const todo = ps.filter(p => p.whatsapp && by[p.id] && !by[p.id].sentAt)
  const bulk = async () => { if (!await ask({ title:'Kirim tiket via WhatsApp?', text:`${todo.length} peserta akan menerima tautan tiket. Pesan dikirim satu per satu dengan jeda beberapa detik.`, ok:'Kirim sekarang', icon:'whatsapp' })) return
    setBusy(true); let ok = 0
    for (let i = 0; i < todo.length; i++) { setInfo(`Mengirim ${i + 1} dari ${todo.length}…`); if (await one(todo[i], by[todo[i].id])) ok++; await wait(3000 + Math.random() * 3000) }
    await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'kirim WhatsApp massal', sent: ok, failed: todo.length - ok })
    setInfo(`Selesai: ${ok} terkirim, ${todo.length - ok} gagal.`); setBusy(false) }
  return <><div className="d-flex gap-2 mb-3 flex-wrap"><h1 className="h4 me-auto">Distribusi tiket (WhatsApp)</h1>
    <button className={'btn btn-success btn-sm' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={busy || !todo.length || !mapsOk} onClick={bulk}>{`Kirim semua yang belum (${todo.length})`}</button></div>
    <MapsWarn loaded={sl} mapsOk={mapsOk}/>
    {info && <div className="alert alert-info">{info}</div>}
    <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Peserta</th><th>WhatsApp</th><th>Status</th><th/></tr></thead><tbody>
    {loading && <SkelRows rows={6} cols={4}/>}
    {!loading && ps.filter(p => by[p.id]).map(p => { const t = by[p.id]; return <tr key={p.id}><td>{p.name}</td><td>{p.whatsapp || '-'}</td>
      <td>{state[p.id] === 'Mengirim…' ? <Skel w="6rem" h=".9rem"/> : (state[p.id] || (t.sentAt ? 'Terkirim' : 'Belum'))}</td>
      <td className="text-end"><button className={'btn btn-success btn-sm' + (state[p.id] === 'Mengirim…' ? ' is-busy' : '')} disabled={busy || !p.whatsapp || !mapsOk || state[p.id] === 'Mengirim…'} onClick={() => one(p, t)}>{t.sentAt ? 'Kirim ulang' : 'Kirim'}</button></td></tr> })}
    {!loading && !ts.length && <tr><td colSpan="4" className="text-center text-muted py-4">Belum ada tiket. Buat tiket dulu di menu Tiket.</td></tr>}</tbody></table></div></>
}
