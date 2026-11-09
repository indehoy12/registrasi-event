import { useDialog } from '../ui'
import { Badge } from '../ui'
import { useState } from 'react'; import QRCode from 'qrcode'; import JSZip from 'jszip'
import { addDoc, collection, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { useCol, wait, sendTicketWA, maskWa, maskEmail, showCode } from '../hooks'; import { auth, db } from '../firebase'
const newToken = () => { const b = crypto.getRandomValues(new Uint8Array(24)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') }
const save = (href, name) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }
export default function Tickets() {
  const ask = useDialog()
  const ps = useCol('participants'), ts = useCol('tickets'), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [auto, setAuto] = useState(true)
  const by = Object.fromEntries(ts.filter(t => t.status !== 'dicabut').map(t => [t.participantId, t]))
  const todo = ps.filter(p => !by[p.id])
  const gen = async (list) => { setBusy(true); setMsg('')
    try { const made = list.map(p => ({ p, id: newToken() }))
      for (let i = 0; i < made.length; i += 400) { const b = writeBatch(db)
        made.slice(i, i + 400).forEach(({ p, id }) => b.set(doc(db, 'tickets', id), { participantId: p.id, participantName: p.name, institution: p.institution || '', emailMasked: maskEmail(p.email), waMasked: maskWa(p.whatsapp), status: 'aktif', createdAt: serverTimestamp(), sentAt: null })); await b.commit() }
      await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'buat tiket', count: list.length })
      let info = `${list.length} tiket dibuat.`; setMsg(info)
      if (auto) { const q = made.filter(x => x.p.whatsapp); let ok = 0
        for (let i = 0; i < q.length; i++) { setMsg(`${info} Mengirim WhatsApp ${i + 1} dari ${q.length}…`)
          try { await sendTicketWA(q[i].id); ok++ } catch { /* yang gagal tetap berstatus Belum di menu Distribusi */ }
          if (i < q.length - 1) await wait(3000 + Math.random() * 3000) }
        await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'kirim WhatsApp otomatis', sent: ok, failed: q.length - ok })
        info += ` WhatsApp: ${ok} terkirim, ${q.length - ok} gagal, ${list.length - q.length} tanpa nomor. Yang belum terkirim bisa diulang di menu Distribusi.` }
      setMsg(info) } catch (e) { setMsg('Gagal membuat tiket: ' + e.message) } setBusy(false) }
  const png = async (t, p) => save(await QRCode.toDataURL(t.id, { width: 700, margin: 2 }), `tiket-${(p?.name || t.id).replace(/[^\w-]+/g, '_')}.png`)
  const zip = async () => { setBusy(true); const z = new JSZip()
    for (const t of ts.filter(t => t.status === 'aktif')) z.file(`${t.participantName.replace(/[^\w-]+/g, '_')}-${t.id.slice(0, 5)}.png`, (await QRCode.toDataURL(t.id, { width: 700, margin: 2 })).split(',')[1], { base64: true })
    save(URL.createObjectURL(await z.generateAsync({ type: 'blob' })), 'tiket-semua.zip'); setBusy(false) }
  const revoke = async (t) => { if (!await ask({ title:'Cabut tiket?', text:`Tiket ${t.participantName} tidak akan bisa dipakai untuk check-in lagi.`, ok:'Cabut tiket', danger:true, icon:'slash-circle' })) return
    await updateDoc(doc(db, 'tickets', t.id), { status: 'dicabut' })
    await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'cabut tiket', participant: t.participantName }) }
  return <><div className="d-flex gap-2 mb-3 flex-wrap"><h1 className="h4 me-auto">Tiket QR</h1>
    <label className="form-check d-flex align-items-center gap-2 small mb-0"><input type="checkbox" className="form-check-input mt-0" checked={auto} onChange={e => setAuto(e.target.checked)}/>Kirim otomatis via WhatsApp</label>
    <button className="btn btn-outline-primary btn-sm" disabled={busy || !ts.length} onClick={zip}>Unduh semua PNG (ZIP)</button>
    <button className="btn btn-primary btn-sm" disabled={busy || !todo.length} onClick={() => gen(todo)}>{busy ? 'Memproses…' : `Buat ${todo.length} tiket`}</button></div>
    {msg && <div className="alert alert-info">{msg}</div>}
    <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Peserta</th><th>No. tiket</th><th>Status tiket</th><th/></tr></thead><tbody>
      {ps.map(p => { const t = by[p.id]; return <tr key={p.id}><td>{p.name}</td><td className="tk-code">{t ? showCode(t.id) : '-'}</td><td><Badge s={t ? t.status : 'belum'}/></td>
        <td className="text-end">{!t && <button className="btn btn-link btn-sm" disabled={busy} onClick={() => gen([p])}>Buat tiket</button>}
        {t && <button className="btn btn-link btn-sm" onClick={() => png(t, p)}>Unduh PNG</button>}
        {t?.status === 'aktif' && <button className="btn btn-link btn-sm text-danger" onClick={() => revoke(t)}>Cabut</button>}</td></tr> })}</tbody></table></div></>
}
