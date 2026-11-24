import { useDialog, Badge, SkelRows, MapsWarn, Skel, Pager, halaman } from '../ui'
import { useDeferredValue, useEffect, useState } from 'react'; import QRCode from 'qrcode'
import { addDoc, collection, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { useColState, useSeminar, wait, perusahaanTeks, cariCocok, sendTicketWA, sendTicketEmail, validEmail, maskWa, maskEmail, showCode, useJagaProses, normHari, normCode, urutNama } from '../hooks'; import { auth, db } from '../firebase'
const newToken = () => { const b = crypto.getRandomValues(new Uint8Array(24)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') }
const save = (href, name) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }
// Pencarian langsung sesuai kolom tabel ini (nama, nomor undangan, status undangan); nomor undangan ikut dicari mulai 3 karakter (atau bila ada angka)
// agar mengetik satu-dua huruf nama tidak memunculkan peserta yang namanya tidak cocok hanya karena nomor undangannya.
const STATUS = { aktif: 'Aktif', terpakai: 'Terpakai', dicabut: 'Dicabut' }
const cocok = (p, t, q) => cariCocok(q, `${p.name || ''} ${p.email || ''} ${p.institution || ''} ${p.pimpinan || ''} ${p.domisili || ''} ${p.wilayah || ''} ${p.bidang || ''} ${t ? STATUS[t.status] || t.status : 'Belum dibuat'}`, t ? showCode(t.id) : '')

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
      <div className={'qr-view' + (mati ? ' off' : '')}>{img ? <img src={img} alt={`Kode QR undangan ${t.participantName}`}/> : <Skel w="min(290px,100%)" h="290px" r="12px"/>}</div>
      <div className="code-chip mb-2">No. {showCode(t.id)}</div>
      <div className="mb-3"><Badge s={t.status}/></div>
      {mati && <div className="small text-danger mb-3">Undangan sudah dicabut.</div>}
      <div className="d-grid gap-2"><button className="btn btn-primary" autoFocus onClick={onClose}>Tutup</button>
        <button className="btn btn-outline-primary" disabled={!img} onClick={onPng}><i className="bi bi-download"/> Unduh PNG</button></div>
    </div></div>
}
export default function Tickets() {
  const ask = useDialog()
  const [ps0, lp] = useColState('participants'), ps = [...ps0].sort(urutNama), [ts, lt] = useColState('tickets'), loading = lp || lt, { loaded: sl, mapsOk } = useSeminar(), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [auto, setAuto] = useState(false), [autoMail, setAutoMail] = useState(false), [q, setQ] = useState(''), qd = useDeferredValue(q), [hal, setHal] = useState(1), [per, setPer] = useState(25), [lihat, setLihat] = useState(null)
  useJagaProses(busy)
  const rincian = (arr) => arr.length ? ` Perhatian: ${arr.slice(0, 5).join('; ')}${arr.length > 5 ? `; dan ${arr.length - 5} lainnya` : ''}.` : ''
  const by = Object.fromEntries(ts.filter(t => t.status !== 'dicabut').map(t => [t.participantId, t]))
  const todo = ps.filter(p => !by[p.id])
  const semua = Object.fromEntries(ts.map(t => [t.id, t])), tLihat = lihat && semua[lihat]   // ambil dari data langsung supaya status (mis. dicabut) ikut berubah di popup
  const tampil = ps.filter(p => cocok(p, by[p.id], qd.trim()))

  const { mulai } = halaman(tampil.length, hal, per), baris = tampil.slice(mulai, mulai + per)
  const gen = async (list) => { setBusy(true); setMsg('')
    try { const made = list.map(p => ({ p, id: newToken() }))
      for (let i = 0; i < made.length; i += 400) { const b = writeBatch(db)
        made.slice(i, i + 400).forEach(({ p, id }) => b.set(doc(db, 'tickets', id), { participantId: p.id, participantName: p.name, institution: p.institution || '', pimpinan: p.pimpinan || '', domisili: p.domisili || '', wilayah: p.wilayah || '', bidang: p.bidang || '', hari: normHari(p.hari), emailMasked: maskEmail(p.email), waMasked: maskWa(p.whatsapp), status: 'aktif', createdAt: serverTimestamp(), sentAt: null })); await b.commit() }
      await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'buat undangan', count: list.length })
      let info = `${list.length} undangan dibuat.`; setMsg(info)
      // Bila keduanya dicentang: email dikirim lebih dulu, lalu WhatsApp.
      if (autoMail && mapsOk) { const qe = made.filter(x => validEmail(x.p.email || '')), gagal = []; let ok = 0
        for (let i = 0; i < qe.length; i++) { setMsg(`${info} Mengirim email ${i + 1} dari ${qe.length}…`)
          try { const j = await sendTicketEmail(qe[i].id); ok++; if (j.warn) gagal.push(`${qe[i].p.name} (terkirim, status tidak tersimpan; jangan kirim ulang)`) } catch (e) { gagal.push(`${qe[i].p.name} (${e.message})`) }
          if (i < qe.length - 1) await wait(1500 + Math.random() * 1000) }
        await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'kirim email otomatis', sent: ok, failed: qe.length - ok })
        info += ` Email: ${ok} terkirim, ${qe.length - ok} gagal, ${list.length - qe.length} tanpa email valid.${rincian(gagal)}` }
      if (auto && mapsOk) { const q = made.filter(x => x.p.whatsapp), gagal = []; let ok = 0
        for (let i = 0; i < q.length; i++) { setMsg(`${info} Mengirim WhatsApp ${i + 1} dari ${q.length}…`)
          try { const j = await sendTicketWA(q[i].id); ok++; if (j.warn) gagal.push(`${q[i].p.name} (terkirim, status tidak tersimpan; jangan kirim ulang)`) } catch (e) { gagal.push(`${q[i].p.name} (${e.message})`) }
          if (i < q.length - 1) await wait(3000 + Math.random() * 3000) }
        await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'kirim WhatsApp otomatis', sent: ok, failed: q.length - ok })
        info += ` WhatsApp: ${ok} terkirim, ${q.length - ok} gagal, ${list.length - q.length} tanpa nomor.${rincian(gagal)}` }
      if (!(auto && mapsOk) && !(autoMail && mapsOk)) info += ' Belum dikirim ke peserta.'
      setMsg(info) } catch (e) { setMsg('Gagal membuat undangan: ' + e.message) } setBusy(false) }
  const png = async (t, p) => save(await QRCode.toDataURL(t.id, { width: 700, margin: 2 }), `undangan-${(p?.name || t.id).replace(/[^\w-]+/g, '_')}.png`)
  const zip = async () => { setBusy(true); const JSZip = (await import('jszip')).default, z = new JSZip()
    for (const t of ts.filter(t => t.status === 'aktif')) z.file(`${t.participantName.replace(/[^\w-]+/g, '_')}-${t.id.slice(0, 5)}.png`, (await QRCode.toDataURL(t.id, { width: 700, margin: 2 })).split(',')[1], { base64: true })
    save(URL.createObjectURL(await z.generateAsync({ type: 'blob' })), 'undangan-semua.zip'); setBusy(false) }
  const revoke = async (t) => { if (!await ask({ title:'Cabut undangan?', text:`Undangan ${t.participantName} tidak akan bisa dipakai untuk check-in lagi.`, ok:'Cabut undangan', danger:true, icon:'slash-circle' })) return
    await updateDoc(doc(db, 'tickets', t.id), { status: 'dicabut' })
    await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'cabut undangan', participant: t.participantName }) }
  return <><div className="d-flex gap-2 mb-3 flex-wrap"><h1 className="h4 me-auto">Undangan QR</h1>
    <label className="form-check d-flex align-items-center gap-2 small mb-0"><input type="checkbox" className="form-check-input mt-0" checked={autoMail && mapsOk} disabled={!mapsOk} onChange={e => setAutoMail(e.target.checked)}/>Kirim otomatis via email</label>
    <label className="form-check d-flex align-items-center gap-2 small mb-0"><input type="checkbox" className="form-check-input mt-0" checked={auto && mapsOk} disabled={!mapsOk} onChange={e => setAuto(e.target.checked)}/>dan WhatsApp</label>
    <button className="btn btn-outline-primary btn-sm" disabled={busy || !ts.length} onClick={zip}>Unduh semua PNG (ZIP)</button>
    <button className={'btn btn-primary btn-sm' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={busy || !todo.length} onClick={() => gen(todo)}>{`Buat ${todo.length} undangan`}</button></div>
    <MapsWarn loaded={sl} mapsOk={mapsOk}/>
    {msg && <div className="alert alert-info">{msg}</div>}
    <div className="d-flex align-items-center gap-3 flex-wrap mb-2"><input className="form-control" style={{ maxWidth: 420 }} type="search" autoComplete="off" aria-label="Cari nama PIC, perusahaan, atau nomor undangan" placeholder="Cari nama PIC, perusahaan, email, nomor undangan, atau status" value={q} onChange={e => { setQ(e.target.value); setHal(1) }}/>
      {!loading && q.trim() && <span className="small text-muted" role="status" aria-live="polite">{tampil.length} dari {ps.length} peserta</span>}</div>
    <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th style={{ width: '3rem' }}>No</th><th>Nama PIC/Admin</th><th>Nama Perusahaan/Nama Individu</th><th>Email Address</th><th>No. undangan</th><th>Status undangan</th><th/></tr></thead><tbody>
      {loading && <SkelRows rows={6} cols={7}/>}
      {!loading && !tampil.length && <tr><td colSpan={7} className="text-center text-muted py-4">{q.trim() ? <>Tidak ada peserta yang cocok dengan “{q.trim()}”. <button className="btn btn-link btn-sm p-0 align-baseline" onClick={() => setQ('')}>Hapus pencarian</button></> : 'Belum ada peserta.'}</td></tr>}
      {!loading && baris.map((p, i) => { const t = by[p.id]; return <tr key={p.id}><td className="text-muted">{mulai + i + 1}</td><td>{p.name}</td><td>{p.institution || <span className="text-muted">-</span>}{p.pimpinan && <div className="small text-muted">{p.pimpinan}</div>}</td><td className="small">{p.email || <span className="text-muted">-</span>}</td><td className="tk-code">{t ? showCode(t.id) : '-'}</td><td><Badge s={t ? t.status : 'belum'}/></td>
        <td className="text-end">{!t && <button className="btn btn-link btn-sm" disabled={busy} onClick={() => gen([p])}>Buat undangan</button>}
        {t && <button className="btn btn-link btn-sm" onClick={() => setLihat(t.id)}>Lihat QR</button>}
        {t && <button className="btn btn-link btn-sm" onClick={() => png(t, p)}>Unduh PNG</button>}
        {t?.status === 'aktif' && <button className="btn btn-link btn-sm text-danger" onClick={() => revoke(t)}>Cabut</button>}</td></tr> })}</tbody></table></div>
    {!loading && <Pager total={tampil.length} hal={hal} setHal={setHal} per={per} setPer={setPer} nama="peserta"/>}
    {tLihat && <QrModal t={tLihat} onClose={() => setLihat(null)} onPng={() => png(tLihat, ps.find(x => x.id === tLihat.participantId))}/>}</>
}
