import { useEffect, useRef, useState } from 'react'; import { useParams } from 'react-router-dom'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'; import QRCode from 'qrcode'; import { db } from '../firebase'; import { jam, tgl, showCode, normMaps, coordsFromMaps, hariList, hariAktif, hariLabel, usedOn, hariPeserta } from '../hooks'; import { Skel } from '../ui'

const wrap = (x, text, max) => { const out = []; let line = ''
  String(text).split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > max && line) { out.push(line); line = w } else line = t }); if (line) out.push(line); return out }

export default function PublicTicket() {
  const { token } = useParams(), [t, setT] = useState(null), [sem, setSem] = useState({}), [img, setImg] = useState(''), [err, setErr] = useState(''), [semReady, setSemReady] = useState(false)
  const prev = useRef(null)
  // QR dan info seminar dimuat sekali; status undangan dipantau langsung agar banner muncul otomatis saat petugas check-in
  useEffect(() => { (async () => { try {
    setImg(await QRCode.toDataURL(token, { width: 700, margin: 2 }))
    const m = await getDoc(doc(db, 'seminar', 'main')); if (m.exists()) setSem(m.data()); setSemReady(true) } catch { setSemReady(true); setErr('Undangan tidak dapat dimuat. Muat ulang halaman.') } })() }, [token])
  useEffect(() => onSnapshot(doc(db, 'tickets', token),
    s => { if (!s.exists()) return setErr('Undangan tidak ditemukan. Periksa tautan atau hubungi panitia.')
      const d = s.data(), n = Object.keys(d.usedDays || {}).length; if (prev.current !== null && n > prev.current) navigator.vibrate?.([100, 60, 100]); prev.current = n; setT(d); setErr('') },
    () => setErr('Undangan tidak dapat dimuat. Muat ulang halaman.')), [token])

  const kode = showCode(token)
  const waktu = sem.time ? `Pukul ${sem.time.replace(':', '.')}${sem.timeEnd ? ' - ' + sem.timeEnd.replace(':', '.') : ''} WIB` : ''
  const peserta = t && [['Nama PIC/Admin', t.participantName], ['Nama perusahaan/individu', t.institution], ['Nama pimpinan', t.pimpinan], ['Domisili', t.domisili], ['Wilayah operasional', t.wilayah], ['Jenis usaha', t.bidang], ['Email', t.emailMasked], ['Nomor WhatsApp', t.waMasked], ['Nomor undangan', kode]].filter(r => r[1])
  const peta = normMaps(sem.mapsUrl), pt = peta ? coordsFromMaps(peta) : null
  // Kegiatan 1 atau 2 hari; QR yang sama dipakai di semua hari, kehadiran dicatat per hari
  // Peserta berbeda tiap hari: undangan hanya menampilkan hari milik peserta itu
  const days = hariList(sem), dayList = days.filter((_, i) => (t ? hariPeserta(t, days) : [1]).includes(i + 1)), multi = dayList.length > 1, today = hariAktif(dayList), usedToday = t ? usedOn(t, today, days) : null
  const tglD = (d) => /^\d{4}-/.test(d) ? tgl(d) : ''
  const acara = [...(multi ? dayList.map(d => [`Hari ke-${days.indexOf(d) + 1}`, tglD(d)]) : [[days.length > 1 ? `Hari ke-${days.indexOf(dayList[0]) + 1}` : 'Hari/Tanggal', tglD(dayList[0])]]), ['Waktu', waktu], ['Tempat', sem.location], ['Agenda', sem.agenda]].filter(r => r[1])

  // Undangan lengkap (nama, data kegiatan, QR) sebagai satu gambar PNG
  const unduh = async () => {
    const W = 900, P = 60, c = document.createElement('canvas'), x = c.getContext('2d'), F = "'Plus Jakarta Sans', system-ui, sans-serif"
    const rows = [...peserta.filter(r => r[0] !== 'Email' && r[0] !== 'Nomor WhatsApp'), ...acara]
    x.font = `700 40px ${F}`; const judul = wrap(x, sem.title || 'Undangan Seminar', W - P * 2)
    let H = 150 + judul.length * 52 + rows.length * 96 + 760; c.width = W; c.height = H
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = '#0f766e'; x.fillRect(0, 0, W, 150 + judul.length * 52)
    x.fillStyle = '#cfeae6'; x.font = `600 24px ${F}`; x.fillText('UNDANGAN PESERTA', P, 70)
    x.fillStyle = '#fff'; x.font = `700 40px ${F}`; judul.forEach((l, i) => x.fillText(l, P, 130 + i * 52))
    let y = 150 + judul.length * 52 + 70
    rows.forEach(([k, v]) => { x.fillStyle = '#667085'; x.font = `500 24px ${F}`; x.fillText(k, P, y)
      x.fillStyle = '#18212f'; x.font = k === 'Nomor undangan' ? "700 32px ui-monospace, Consolas, 'DejaVu Sans Mono', monospace" : `700 32px ${F}`; const ls = wrap(x, v, W - P * 2); ls.forEach((l, i) => x.fillText(l, P, y + 40 + i * 38)); y += 96 + (ls.length - 1) * 38 })
    const q = new Image(); q.src = img; await new Promise(r => { q.onload = r })
    x.drawImage(q, (W - 600) / 2, y + 10, 600, 600); y += 660
    x.fillStyle = '#667085'; x.font = `500 24px ${F}`; x.textAlign = 'center'
    x.fillText('Tunjukkan QR ini kepada petugas.', W / 2, y + 20)
    x.fillText(multi ? 'Dapat diwakilkan. Berlaku untuk kedua hari.' : 'Dapat diwakilkan. Berlaku satu kali.', W / 2, y + 56)
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `undangan-${(t.participantName || kode).replace(/[^\w-]+/g, '_')}.png`; a.click() }

  return <div className="tk-wrap">
    {err && <div className="alert alert-danger m-3">{err}</div>}
    {!t && !err && <div className="tk" aria-busy="true" aria-label="Memuat undangan"><div className="tk-head"><Skel w="40%" h=".8rem" className="mb-2"/><Skel w="75%" h="1.6rem"/></div>
      <div className="tk-body"><Skel h="2.6rem" r="10px" className="mb-3"/><div className="text-center mb-3"><Skel w="240px" h="240px" r="12px"/></div><Skel w="90%" className="mb-2"/><Skel w="60%" className="mb-4"/><Skel h="1rem" className="mb-2"/><Skel h="1rem" className="mb-2"/><Skel h="1rem"/></div></div>}
    {t && usedToday && t.status !== 'dicabut' && <div className="tk-banner" role="status" aria-live="polite"><i className="bi bi-check-circle-fill"/><div><b>Registrasi berhasil. Silakan masuk.</b><small>{days.length > 1 ? `Hari ke-${days.indexOf(today) + 1} · ` : ''}{usedToday.toDate ? `Tercatat hadir pukul ${jam(usedToday)}` : 'Tercatat hadir'}</small></div></div>}
    {t && <div className="tk">
      <div className="tk-head"><div className="tk-eyebrow">Undangan Peserta</div><h1>{sem.title || 'Seminar'}</h1></div>
      <div className="tk-body">
        {t.status === 'aktif' && !usedToday && <div className="tk-status ok"><i className="bi bi-check-circle-fill"/> Undangan aktif</div>}

        {t.status === 'dicabut' && <div className="tk-status off"><i className="bi bi-slash-circle-fill"/> Undangan ini dinonaktifkan. Hubungi panitia.</div>}

        <div className={`tk-qr ${usedToday ? 'used' : ''}`}>{img ? <img src={img} alt="Kode QR undangan"/> : <Skel w="min(300px,100%)" h="300px" r="12px"/>}</div>
        <p className="tk-hint">Tunjukkan QR ini ke petugas. Jika tidak terbaca, sebutkan <b>Nomor undangan</b> di bawah.</p>
        {t.status === 'aktif' && !usedToday && <div className="tk-bright"><i className="bi bi-brightness-high-fill"/> Naikkan kecerahan layar</div>}
        <div className="tk-nomor">Nomor undangan<div className="tk-code fs-3">{kode}</div></div>
        {multi && <ul className="tk-days" aria-label="Status kehadiran per hari">{dayList.map(d => { const u = usedOn(t, d, days); return <li key={d} className={u ? 'on' : ''}><i className={`bi bi-${u ? 'check-circle-fill' : 'circle'}`}/><span>{hariLabel(days, d)}{d === today ? ' (hari ini)' : ''}</span><b>{u ? 'Sudah hadir' : 'Belum hadir'}</b></li> })}</ul>}

        <h2>Data peserta</h2>
        <dl className="tk-list">{peserta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={k === 'Nomor undangan' ? 'tk-code' : ''}>{v}</dd></div>)}</dl>

        <details className="tk-fold" open><summary>Informasi kegiatan</summary>
        {!semReady && <div aria-busy="true" aria-label="Memuat informasi kegiatan"><Skel h="1rem" className="mb-2"/><Skel w="80%" h="1rem" className="mb-2"/><Skel w="60%" h="1rem"/></div>}
        <dl className="tk-list">{acara.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {pt && <iframe className="map-prev" title="Peta lokasi acara (Google Maps)" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${pt.lat},${pt.lng}&z=17&output=embed`}/>}
        {peta && <a className="btn btn-outline-primary w-100 mb-2" href={peta} target="_blank" rel="noopener noreferrer"><i className="bi bi-geo-alt-fill"/> Buka lokasi di Google Maps</a>}
        {sem.description && <p className="tk-desc">{sem.description}</p>}</details>

        <details className="tk-fold"><summary>Ketentuan</summary>
        <ol className="tk-rules">
          <li>{multi ? 'Berlaku untuk kedua hari, dipindai satu kali tiap hari.' : 'Hanya berlaku satu kali.'}</li>
          <li>Dapat diwakilkan. Perwakilan cukup menunjukkan QR ini dan menyebut namanya.</li>
          <li>Bagikan hanya kepada perwakilan Anda.</li>
          <li>Simpan atau unduh undangan ini untuk jaga-jaga bila tidak ada internet.</li>
          
        </ol></details>

        <button className="btn btn-primary w-100 mt-3" disabled={!img} onClick={unduh}><i className="bi bi-download"/> Unduh undangan (PNG)</button>
        <p className="tk-foot">Undangan elektronik, sah tanpa tanda tangan.</p>
      </div></div>}
  </div>
}
