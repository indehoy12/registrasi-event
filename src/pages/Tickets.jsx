import { useDialog, Badge, SkelRows, MapsWarn, Skel } from '../ui'
import { useEffect, useState } from 'react'; import QRCode from 'qrcode'; import JSZip from 'jszip'
import { addDoc, collection, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { useColState, useSeminar, wait, perusahaanTeks, sendTicketWA, sendTicketEmail, validEmail, maskWa, maskEmail, showCode, useJagaProses, normHari, normCode } from '../hooks'; import { auth, db } from '../firebase'
const newToken = () => { const b = crypto.getRandomValues(new Uint8Array(24)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') }
const save = (href, name) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }
// Pencarian langsung: setiap kata yang diketik harus cocok dengan nama, nama perusahaan, atau bidang perusahaan; nomor tiket ikut dicari mulai 3 karakter (atau bila ada angka)
// agar mengetik satu-dua huruf nama tidak memunculkan peserta yang namanya tidak cocok hanya karena nomor tiketnya.
const cocok = (p, t, q) => { const kata = q.toLowerCase().split(/\s+/).filter(Boolean); if (!kata.length) return true
  const teks = `${p.name || ''} ${p.institution || ''} ${p.bidang || ''}`.toLowerCase(), kode = t ? normCode(showCode(t.id)) : ''
  return kata.every(k => teks.includes(k) || (kode && (k.length >= 3 || /\d/.test(k)) && normCode(k) && kode.includes(normCode(k)))) }

// Popup QR: tampil langsung saat tombol "Lihat QR" ditekan; Esc atau klik di luar kotak untuk menutup
function QrModal({ t, onClose, onPng }) {
  const [img, setImg] = useState('')
  useEffect(() => { let batal = false; QRCode.toDataURL(t.id, { width: 700, margin: 2 }).then(u => { if (!batal) setImg(u) }); return () => { batal = true } }, [t.id])
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) })
  const mati = t.status === 'dicabut'
  return <div className="mdl-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="mdl text-center" role="dialog" aria-modal="true" aria-labelledby="qr-t">
      <h2 id="qr-t" className="h5 mb-0">{t.participantName}</h2>
      <div className="text-muted small">{perusahaanTeks(t) || 'Tanpa perusahaan'}</div>
      <div className={'qr-view' + (mati ? ' off' : '')}>{img ? <img src={img} alt={`Kode QR tiket ${t.participantName}`}/> : <Skel w="min(290px,100%)" h="290px" r="12px"/>}</div>
      <div className="code-chip mb-2">No. {showCode(t.id)}</div>
      <div className="mb-3"><Badge s={t.status}/></div>
      {mati && <div className="small text-danger mb-3">Tiket ini sudah dicabut, QR di atas tidak bisa dipakai untuk check-in.</div>}
      <div className="d-grid gap-2"><button className="btn btn-primary" autoFocus onClick={onClose}>Tutup</button>
        <button className="btn btn-outline-primary" disabled={!img} onClick={onPng}><i className="bi bi-download"/> Unduh PNG</button></div>
    </div></div>
}
export default function Tickets() {
  const ask = useDialog()
  const [ps, lp] = useColState('participants'), [ts, lt] = useColState('tickets'), loading = lp || lt, { loaded: sl, mapsOk } = useSeminar(), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [auto, setAuto] = useState(false), [autoMail, setAutoMail] = useState(false), [q, setQ] = useState(''), [lihat, setLihat] = useState(null)
  useJagaProses(busy)
  const rincian = (arr) => arr.length ? ` Perhatian: ${arr.slice(0, 5).join('; ')}${arr.length > 5 ? `; dan ${arr.length - 5} lainnya` : ''}.` : ''
  const by = Object.fromEntries(ts.filter(t => t.status !== 'dicabut').map(t => [t.participantId, t]))
  const todo = ps.filter(p => !by[p.id])
  const semua = Object.fromEntries(ts.map(t => [t.id, t])), tLihat = lihat && semua[lihat]   // ambil dari data langsung supaya status (mis. dicabut) ikut berubah di popup
  const tampil = ps.filter(p => cocok(p, by[p.id], q.trim()))
  const gen = async (list) => { setBusy(true); setMsg('')
    try { const made = list.map(p => ({ p, id: newToken() }))
      for (let i = 0; i < made.length; i += 400) { const b = writeBatch(db)
        made.slice(i, i + 400).forEach(({ p, id }) => b.set(doc(db, 'tickets', id), { participantId: p.id, participantName: p.name, institution: p.institution || '', bidang: p.bidang || '', hari: normHari(p.hari), emailMasked: maskEmail(p.email), waMasked: maskWa(p.whatsapp), status: 'aktif', createdAt: serverTimestamp(), sentAt: null })); await b.commit() }
      await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'buat tiket', count: list.length })
      let info = `${list.length} tiket dibuat.`; setMsg(info)
      if (auto && mapsOk) { const q = made.filter(x => x.p.whatsapp), gagal = []; let ok = 0
        for (let i = 0; i < q.length; i++) { setMsg(`${info} Mengirim WhatsApp ${i + 1} dari ${q.length}…`)
          try { const j = await sendTicketWA(q[i].id); ok++; if (j.warn) gagal.push(`${q[i].p.name} (terkirim, status tidak tersimpan; jangan kirim ulang)`) } catch (e) { gagal.push(`${q[i].p.name} (${e.message})`) }
          if (i < q.length - 1) await wait(3000 + Math.random() * 3000) }
        await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'kirim WhatsApp otomatis', sent: ok, failed: q.length - ok })
        info += ` WhatsApp: ${ok} terkirim, ${q.length - ok} gagal, ${list.length - q.length} tanpa nomor.${rincian(gagal)} Yang belum terkirim bisa diulang di menu Distribusi.` }
      if (autoMail && mapsOk) { const qe = made.filter(x => validEmail(x.p.email || '')), gagal = []; let ok = 0
        for (let i = 0; i < qe.length; i++) { setMsg(`${info} Mengirim email ${i + 1} dari ${qe.length}…`)
          try { const j = await sendTicketEmail(qe[i].id); ok++; if (j.warn) gagal.push(`${qe[i].p.name} (terkirim, status tidak tersimpan; jangan kirim ulang)`) } catch (e) { gagal.push(`${qe[i].p.name} (${e.message})`) }
          if (i < qe.length - 1) await wait(1500 + Math.random() * 1000) }
        await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'kirim email otomatis', sent: ok, failed: qe.length - ok })
        info += ` Email: ${ok} terkirim, ${qe.length - ok} gagal, ${list.length - qe.length} tanpa email valid.${rincian(gagal)} Yang belum terkirim bisa diulang di menu Distribusi.` }
      if (!(auto && mapsOk) && !(autoMail && mapsOk)) info += ' Tiket belum dikirim ke peserta. Kirim lewat menu Kirim tiket bila sudah siap.'
      setMsg(info) } catch (e) { setMsg('Gagal membuat tiket: ' + e.message) } setBusy(false) }
  const png = async (t, p) => save(await QRCode.toDataURL(t.id, { width: 700, margin: 2 }), `tiket-${(p?.name || t.id).replace(/[^\w-]+/g, '_')}.png`)
  const zip = async () => { setBusy(true); const z = new JSZip()
    for (const t of ts.filter(t => t.status === 'aktif')) z.file(`${t.participantName.replace(/[^\w-]+/g, '_')}-${t.id.slice(0, 5)}.png`, (await QRCode.toDataURL(t.id, { width: 700, margin: 2 })).split(',')[1], { base64: true })
    save(URL.createObjectURL(await z.generateAsync({ type: 'blob' })), 'tiket-semua.zip'); setBusy(false) }
  const revoke = async (t) => { if (!await ask({ title:'Cabut tiket?', text:`Tiket ${t.participantName} tidak akan bisa dipakai untuk check-in lagi.`, ok:'Cabut tiket', danger:true, icon:'slash-circle' })) return
    await updateDoc(doc(db, 'tickets', t.id), { status: 'dicabut' })
    await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'cabut tiket', participant: t.participantName }) }
  return <><div className="d-flex gap-2 mb-3 flex-wrap"><h1 className="h4 me-auto">Tiket QR</h1>
    <label className="form-check d-flex align-items-center gap-2 small mb-0"><input type="checkbox" className="form-check-input mt-0" checked={auto && mapsOk} disabled={!mapsOk} onChange={e => setAuto(e.target.checked)}/>Kirim otomatis via WhatsApp</label>
    <label className="form-check d-flex align-items-center gap-2 small mb-0"><input type="checkbox" className="form-check-input mt-0" checked={autoMail && mapsOk} disabled={!mapsOk} onChange={e => setAutoMail(e.target.checked)}/>dan email</label>
    <button className="btn btn-outline-primary btn-sm" disabled={busy || !ts.length} onClick={zip}>Unduh semua PNG (ZIP)</button>
    <button className={'btn btn-primary btn-sm' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={busy || !todo.length} onClick={() => gen(todo)}>{`Buat ${todo.length} tiket`}</button></div>
    <MapsWarn loaded={sl} mapsOk={mapsOk}/>
    {msg && <div className="alert alert-info">{msg}</div>}
    <div className="d-flex align-items-center gap-3 flex-wrap mb-2"><input className="form-control" style={{ maxWidth: 420 }} type="search" autoComplete="off" aria-label="Cari peserta atau nomor tiket" placeholder="Cari nama, perusahaan, atau nomor tiket (langsung muncul)" value={q} onChange={e => setQ(e.target.value)}/>
      {!loading && q.trim() && <span className="small text-muted" role="status" aria-live="polite">{tampil.length} dari {ps.length} peserta</span>}</div>
    <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Peserta</th><th>No. tiket</th><th>Status tiket</th><th/></tr></thead><tbody>
      {loading && <SkelRows rows={6} cols={4}/>}
      {!loading && !tampil.length && <tr><td colSpan={4} className="text-center text-muted py-4">{q.trim() ? <>Tidak ada peserta yang cocok dengan “{q.trim()}”. <button className="btn btn-link btn-sm p-0 align-baseline" onClick={() => setQ('')}>Hapus pencarian</button></> : 'Belum ada peserta.'}</td></tr>}
      {!loading && tampil.map(p => { const t = by[p.id]; return <tr key={p.id}><td>{p.name}</td><td className="tk-code">{t ? showCode(t.id) : '-'}</td><td><Badge s={t ? t.status : 'belum'}/></td>
        <td className="text-end">{!t && <button className="btn btn-link btn-sm" disabled={busy} onClick={() => gen([p])}>Buat tiket</button>}
        {t && <button className="btn btn-link btn-sm" onClick={() => setLihat(t.id)}>Lihat QR</button>}
        {t && <button className="btn btn-link btn-sm" onClick={() => png(t, p)}>Unduh PNG</button>}
        {t?.status === 'aktif' && <button className="btn btn-link btn-sm text-danger" onClick={() => revoke(t)}>Cabut</button>}</td></tr> })}</tbody></table></div>
    {tLihat && <QrModal t={tLihat} onClose={() => setLihat(null)} onPng={() => png(tLihat, ps.find(x => x.id === tLihat.participantId))}/>}</>
}
