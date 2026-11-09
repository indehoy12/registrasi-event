import { useEffect, useRef, useState } from 'react'; import { useParams } from 'react-router-dom'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'; import QRCode from 'qrcode'; import { db } from '../firebase'; import { jam, tgl, showCode, normMaps } from '../hooks'; import { Skel } from '../ui'

const wrap = (x, text, max) => { const out = []; let line = ''
  String(text).split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > max && line) { out.push(line); line = w } else line = t }); if (line) out.push(line); return out }

export default function PublicTicket() {
  const { token } = useParams(), [t, setT] = useState(null), [sem, setSem] = useState({}), [img, setImg] = useState(''), [err, setErr] = useState(''), [semReady, setSemReady] = useState(false)
  const prev = useRef(null)
  // QR dan info seminar dimuat sekali; status tiket dipantau langsung agar banner muncul otomatis saat petugas check-in
  useEffect(() => { (async () => { try {
    setImg(await QRCode.toDataURL(token, { width: 700, margin: 2 }))
    const m = await getDoc(doc(db, 'seminar', 'main')); if (m.exists()) setSem(m.data()); setSemReady(true) } catch { setSemReady(true); setErr('Tiket tidak dapat dimuat saat ini. Silakan muat ulang halaman atau coba beberapa saat lagi.') } })() }, [token])
  useEffect(() => onSnapshot(doc(db, 'tickets', token),
    s => { if (!s.exists()) return setErr('Tiket tidak ditemukan. Mohon periksa kembali tautan yang Anda terima atau hubungi panitia penyelenggara.')
      const d = s.data(); if (prev.current === 'aktif' && d.status === 'terpakai') navigator.vibrate?.([100, 60, 100]); prev.current = d.status; setT(d); setErr('') },
    () => setErr('Tiket tidak dapat dimuat saat ini. Silakan muat ulang halaman atau coba beberapa saat lagi.')), [token])

  const kode = showCode(token)
  const waktu = sem.time ? `Pukul ${sem.time.replace(':', '.')}` : ''
  const peserta = t && [['Nama lengkap', t.participantName], ['Instansi', t.institution], ['Email', t.emailMasked], ['Nomor WhatsApp', t.waMasked], ['Nomor tiket', kode]].filter(r => r[1])
  const peta = normMaps(sem.mapsUrl)
  const acara = [['Hari/Tanggal', tgl(sem.date)], ['Waktu', waktu], ['Tempat', sem.location]].filter(r => r[1])

  // Tiket lengkap (nama, data kegiatan, QR) sebagai satu gambar PNG
  const unduh = async () => {
    const W = 900, P = 60, c = document.createElement('canvas'), x = c.getContext('2d'), F = "'Plus Jakarta Sans', system-ui, sans-serif"
    const rows = [...peserta.filter(r => r[0] !== 'Email' && r[0] !== 'Nomor WhatsApp'), ...acara]
    x.font = `700 40px ${F}`; const judul = wrap(x, sem.title || 'Tiket Seminar', W - P * 2)
    let H = 150 + judul.length * 52 + rows.length * 96 + 760; c.width = W; c.height = H
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = '#0f766e'; x.fillRect(0, 0, W, 150 + judul.length * 52)
    x.fillStyle = '#cfeae6'; x.font = `600 24px ${F}`; x.fillText('TIKET MASUK PESERTA', P, 70)
    x.fillStyle = '#fff'; x.font = `700 40px ${F}`; judul.forEach((l, i) => x.fillText(l, P, 130 + i * 52))
    let y = 150 + judul.length * 52 + 70
    rows.forEach(([k, v]) => { x.fillStyle = '#667085'; x.font = `500 24px ${F}`; x.fillText(k, P, y)
      x.fillStyle = '#18212f'; x.font = k === 'Nomor tiket' ? "700 32px ui-monospace, Consolas, 'DejaVu Sans Mono', monospace" : `700 32px ${F}`; const ls = wrap(x, v, W - P * 2); ls.forEach((l, i) => x.fillText(l, P, y + 40 + i * 38)); y += 96 + (ls.length - 1) * 38 })
    const q = new Image(); q.src = img; await new Promise(r => { q.onload = r })
    x.drawImage(q, (W - 600) / 2, y + 10, 600, 600); y += 660
    x.fillStyle = '#667085'; x.font = `500 24px ${F}`; x.textAlign = 'center'
    x.fillText('Tunjukkan kode QR ini kepada petugas registrasi.', W / 2, y + 20)
    x.fillText('Dapat diwakilkan. Berlaku untuk satu kali registrasi.', W / 2, y + 56)
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `tiket-${(t.participantName || kode).replace(/[^\w-]+/g, '_')}.png`; a.click() }

  return <div className="tk-wrap">
    {err && <div className="alert alert-danger m-3">{err}</div>}
    {!t && !err && <div className="tk" aria-busy="true" aria-label="Memuat tiket"><div className="tk-head"><Skel w="40%" h=".8rem" className="mb-2"/><Skel w="75%" h="1.6rem"/></div>
      <div className="tk-body"><Skel h="2.6rem" r="10px" className="mb-3"/><div className="text-center mb-3"><Skel w="240px" h="240px" r="12px"/></div><Skel w="90%" className="mb-2"/><Skel w="60%" className="mb-4"/><Skel h="1rem" className="mb-2"/><Skel h="1rem" className="mb-2"/><Skel h="1rem"/></div></div>}
    {t && t.status === 'terpakai' && <div className="tk-banner" role="status" aria-live="polite"><i className="bi bi-check-circle-fill"/><div><b>Registrasi berhasil. Silakan masuk.</b>{t.usedAt && <small>Tercatat hadir pukul {jam(t.usedAt)}</small>}</div></div>}
    {t && <div className="tk">
      <div className="tk-head"><div className="tk-eyebrow">Tiket Masuk Peserta</div><h1>{sem.title || 'Seminar'}</h1></div>
      <div className="tk-body">
        {t.status === 'aktif' && <div className="tk-status ok"><i className="bi bi-check-circle-fill"/> Tiket aktif dan siap digunakan</div>}

        {t.status === 'dicabut' && <div className="tk-status off"><i className="bi bi-slash-circle-fill"/> Tiket ini telah dinonaktifkan oleh panitia dan tidak dapat digunakan. Silakan menghubungi panitia penyelenggara.</div>}

        <div className={`tk-qr ${t.status === 'terpakai' ? 'used' : ''}`}>{img ? <img src={img} alt="Kode QR tiket"/> : <Skel w="min(300px,100%)" h="300px" r="12px"/>}</div>
        <p className="tk-hint">Tunjukkan kode QR ini kepada petugas registrasi pada saat kedatangan. Jika QR tidak dapat dipindai, sebutkan <b>Nomor tiket</b> di bawah.</p>
        {t.status === 'aktif' && <div className="tk-bright"><i className="bi bi-brightness-high-fill"/> Naikkan kecerahan layar agar QR mudah dipindai</div>}
        <div className="tk-nomor">Nomor tiket<div className="tk-code fs-3">{kode}</div></div>

        <h2>Data peserta</h2>
        <dl className="tk-list">{peserta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={k === 'Nomor tiket' ? 'tk-code' : ''}>{v}</dd></div>)}</dl>

        <details className="tk-fold" open><summary>Informasi kegiatan</summary>
        {!semReady && <div aria-busy="true" aria-label="Memuat informasi kegiatan"><Skel h="1rem" className="mb-2"/><Skel w="80%" h="1rem" className="mb-2"/><Skel w="60%" h="1rem"/></div>}
        <dl className="tk-list">{acara.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {peta && <a className="btn btn-outline-primary w-100 mb-2" href={peta} target="_blank" rel="noopener noreferrer"><i className="bi bi-geo-alt-fill"/> Buka lokasi di Google Maps</a>}
        {sem.description && <p className="tk-desc">{sem.description}</p>}</details>

        <details className="tk-fold"><summary>Ketentuan</summary>
        <ol className="tk-rules">
          <li>Tiket ini hanya dapat digunakan satu kali.</li>
          <li>Apabila Anda berhalangan hadir, tiket ini dapat diwakilkan kepada orang lain. Perwakilan cukup menunjukkan kode QR ini dan menyebutkan namanya kepada petugas.</li>
          <li>Bagikan tautan atau kode QR ini hanya kepada orang yang Anda tunjuk sebagai perwakilan.</li>
          <li>Simpan tiket ini atau unduh sebagai gambar agar tetap dapat ditunjukkan apabila koneksi internet tidak tersedia.</li>
          <li>Apabila terdapat kendala, silakan menghubungi panitia penyelenggara.</li>
        </ol></details>

        <button className="btn btn-primary w-100 mt-3" disabled={!img} onClick={unduh}><i className="bi bi-download"/> Unduh tiket (PNG)</button>
        <p className="tk-foot">Tiket ini diterbitkan secara elektronik oleh panitia penyelenggara dan sah tanpa tanda tangan.</p>
      </div></div>}
  </div>
}
