import { useDialog, SkelRows, MapsWarn, Skel } from '../ui'
import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useColState, useSeminar, wait, sendTicketWA, sendTicketEmail, validEmail, useJagaProses } from '../hooks'; import { auth, db } from '../firebase'
export default function Distribution() {
  const ask = useDialog()
  const [ps, lp] = useColState('participants'), [ts, lt] = useColState('tickets'), loading = lp || lt, { loaded: sl, mapsOk } = useSeminar(), by = Object.fromEntries(ts.filter(t => t.status === 'aktif').map(t => [t.participantId, t]))
  const [state, setState] = useState({}), [busy, setBusy] = useState(false), [info, setInfo] = useState('')
  const set = (k, v) => setState(s => ({ ...s, [k]: v })); useJagaProses(busy)
  const wa = async (p, t) => { const k = p.id + 'wa'; set(k, 'Mengirim…')
    try { const j = await sendTicketWA(t.id); set(k, (j.via === 'fonnte-gambar' ? 'Terkirim (gambar QR)' : `Terkirim (tautan${j.note ? '; gambar ditolak: ' + j.note : ''})`) + (j.warn ? ' - status gagal tersimpan, jangan kirim ulang' : '')); return true } catch (e) { set(k, e.message); return false } }
  const mail = async (p, t) => { const k = p.id + 'em'; set(k, 'Mengirim…')
    try { const j = await sendTicketEmail(t.id); set(k, 'Terkirim' + (j.warn ? ' - status gagal tersimpan, jangan kirim ulang' : '')); return true } catch (e) { set(k, e.message); return false } }
  const todoWa = ps.filter(p => p.whatsapp && by[p.id] && !by[p.id].sentAt), todoEm = ps.filter(p => validEmail(p.email || '') && by[p.id] && !by[p.id].emailSentAt)
  const bulk = async (kind) => { const list = kind === 'wa' ? todoWa : todoEm, fn = kind === 'wa' ? wa : mail, nama = kind === 'wa' ? 'WhatsApp' : 'email'
    if (!await ask({ title: `Kirim tiket via ${nama}?`, text: `${list.length} peserta akan menerima tiket. Pesan dikirim satu per satu dengan jeda beberapa detik. Jangan tutup halaman ini sampai selesai.`, ok: 'Kirim sekarang', icon: kind === 'wa' ? 'whatsapp' : 'envelope' })) return
    setBusy(true); let ok = 0
    for (let i = 0; i < list.length; i++) { setInfo(`Mengirim ${nama} ${i + 1} dari ${list.length}…`); if (await fn(list[i], by[list[i].id])) ok++; await wait(kind === 'wa' ? 3000 + Math.random() * 3000 : 1500 + Math.random() * 1000) }
    await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: `kirim ${nama} massal`, sent: ok, failed: list.length - ok })
    setInfo(`Selesai (${nama}): ${ok} terkirim, ${list.length - ok} gagal. Yang gagal tertulis di tabel dan bisa dikirim ulang.`); setBusy(false) }
  const St = ({ v, sent }) => v === 'Mengirim…' ? <Skel w="6rem" h=".9rem"/> : v ? <span className={v.startsWith('Terkirim') ? 'text-success' : 'text-danger'}>{v}</span> : sent ? <span className="text-success">Terkirim</span> : <span className="text-muted">Belum</span>
  return <><div className="d-flex gap-2 mb-3 flex-wrap"><h1 className="h4 me-auto">Distribusi tiket</h1>
    <button className={'btn btn-success btn-sm' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={busy || !todoWa.length || !mapsOk} onClick={() => bulk('wa')}><i className="bi bi-whatsapp"/>{` WhatsApp yang belum (${todoWa.length})`}</button>
    <button className={'btn btn-primary btn-sm' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={busy || !todoEm.length || !mapsOk} onClick={() => bulk('em')}><i className="bi bi-envelope"/>{` Email yang belum (${todoEm.length})`}</button></div>
    <p className="sub">Isi pesan WhatsApp dan email sama. Email membawa QR sebagai lampiran gambar, jadi tetap terbaca walaupun paket WhatsApp tidak mendukung gambar.</p>
    <MapsWarn loaded={sl} mapsOk={mapsOk}/>
    {info && <div className="alert alert-info">{info}</div>}
    <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Peserta</th><th>WhatsApp</th><th>Email</th><th className="text-end">Kirim ulang / kirim</th></tr></thead><tbody>
    {loading && <SkelRows rows={6} cols={4}/>}
    {!loading && ps.filter(p => by[p.id]).map(p => { const t = by[p.id], w = state[p.id + 'wa'], m = state[p.id + 'em'], okEm = validEmail(p.email || ''); return <tr key={p.id}><td>{p.name}</td>
      <td><div className="small text-muted">{p.whatsapp || 'tanpa nomor'}</div><St v={w} sent={t.sentAt}/></td>
      <td><div className="small text-muted">{okEm ? p.email : 'tanpa email valid'}</div><St v={m} sent={t.emailSentAt}/></td>
      <td className="text-end text-nowrap"><button className={'btn btn-success btn-sm me-1' + (w === 'Mengirim…' ? ' is-busy' : '')} disabled={busy || !p.whatsapp || !mapsOk || w === 'Mengirim…'} onClick={() => wa(p, t)}><i className="bi bi-whatsapp"/> {t.sentAt ? 'Ulang' : 'Kirim'}</button>
        <button className={'btn btn-primary btn-sm' + (m === 'Mengirim…' ? ' is-busy' : '')} disabled={busy || !okEm || !mapsOk || m === 'Mengirim…'} onClick={() => mail(p, t)}><i className="bi bi-envelope"/> {t.emailSentAt ? 'Ulang' : 'Kirim'}</button></td></tr> })}
    {!loading && !ts.length && <tr><td colSpan="4" className="text-center text-muted py-4">Belum ada tiket. Buat tiket dulu di menu Tiket.</td></tr>}</tbody></table></div></>
}
