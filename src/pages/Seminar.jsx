import { lazy, Suspense, useEffect, useState } from 'react'; import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'; import { db } from '../firebase'; import { normMaps, mapsLink, coordsFromMaps } from '../hooks'; import { Skel } from '../ui'
const MapPicker = lazy(() => import('../MapPicker'))
export default function Seminar() {
  const [f, setF] = useState({ title:'', date:'', time:'', location:'', date2:'', mapsUrl:'', lat:null, lng:null, description:'' }), [msg, setMsg] = useState(null), [ready, setReady] = useState(false), [awal, setAwal] = useState({ date: '', date2: '' })   // tanggal yang tersimpan, untuk mendeteksi perubahan tanggal
  useEffect(() => { getDoc(doc(db,'seminar','main')).then(s => { if (s.exists()) { setF(x => ({ ...x, ...s.data() })); setAwal({ date: s.data().date || '', date2: s.data().date2 || '' }) } }).finally(() => setReady(true)) }, [])
  const maps = normMaps(f.mapsUrl), has = Number.isFinite(f.lat) && Number.isFinite(f.lng)
  // Pin digeser atau peta disentuh: titik dan tautan Maps ikut diperbarui
  const pick = (lat, lng) => { setF(x => ({ ...x, lat, lng, mapsUrl: mapsLink(lat, lng) })); setMsg(null) }
  // Tautan ditempel: pin mengikuti bila koordinatnya terbaca; bila tidak (tautan pendek), pin lama dihapus agar titik di peta tidak berbeda dengan tautan
  const paste = (e) => { const v = e.target.value, c = coordsFromMaps(v) || (normMaps(v) && /^-?\d/.test(v.trim()) ? coordsFromMaps('?q=' + v.replace(/\s/g, '')) : null); setF(x => ({ ...x, mapsUrl: v, ...(c || { lat: null, lng: null }) })); setMsg(null) }
  const save = async (e) => { e.preventDefault()
    if (f.date2 && (!f.date || f.date2 <= f.date)) return setMsg({ ok: false, t: 'Tanggal hari ke-2 harus setelah tanggal hari ke-1.' })
    // Check-in dicatat per tanggal. Menggeser tanggal setelah ada check-in membuat data lama tidak cocok lagi (dashboard menampilkan 0 hadir).
    // Hanya diperiksa bila tanggal benar-benar diubah, supaya koreksi lokasi/judul tidak ikut terkunci
    if ((f.date || '') !== awal.date || (f.date2 || '') !== awal.date2) try { const baru = [f.date, f.date2].filter(Boolean), tercatat = [...new Set((await getDocs(collection(db, 'checkins'))).docs.map(d => d.data().day).filter(Boolean))].filter(d => !baru.includes(d))
      if (tercatat.length) return setMsg({ ok: false, t: `Sudah ada check-in pada ${tercatat.map(d => d === 'hari-1' ? 'masa uji coba (sebelum tanggal diisi)' : d).join(', ')} yang tidak ada di jadwal baru, sehingga perubahan tanggal ditolak. Jika itu check-in uji coba, batalkan dulu di menu Riwayat kehadiran.` })
    } catch { return setMsg({ ok: false, t: 'Tidak bisa memeriksa data check-in. Periksa koneksi lalu coba simpan lagi.' }) }
    if (!maps) return setMsg({ ok: false, t: 'Titik lokasi Google Maps wajib diisi dengan tautan Google Maps yang benar atau koordinat (contoh: -6.9175, 107.6191).' })
    try { await setDoc(doc(db,'seminar','main'), { ...f, mapsUrl: maps, lat: has ? f.lat : null, lng: has ? f.lng : null }); setF({ ...f, mapsUrl: maps }); setAwal({ date: f.date || '', date2: f.date2 || '' }); setMsg({ ok: true, t: 'Informasi seminar disimpan. Titik lokasi akan ikut dikirim lewat WhatsApp dan tampil di halaman tiket.' }) }
    catch { setMsg({ ok: false, t: 'Gagal menyimpan. Periksa koneksi atau hak akses akun Anda.' }) } }
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setMsg(null) }
  return <><h1 className="h4">Informasi seminar</h1><p className="sub">Data ini tampil di halaman tiket dan dikirim bersama tiket lewat WhatsApp. Isi lengkap sebelum membuat dan mengirim tiket.</p>
    {msg && <div className={`alert alert-${msg.ok ? 'success' : 'danger'}`} role="status">{msg.t}</div>}
    {!ready ? <div className="panel" aria-busy="true" aria-label="Memuat informasi seminar"><Skel w="30%" className="mb-2"/><Skel h="2.4rem" r="8px" className="mb-3"/><Skel w="30%" className="mb-2"/><Skel h="2.4rem" r="8px" className="mb-3"/><Skel h="22rem" r="12px"/></div> :
    <form onSubmit={save} className="panel fgrid">
      <div className="s6"><label className="form-label">Judul seminar</label><input className="form-control" value={f.title} onChange={set('title')}/></div>
      <div className="s2"><label className="form-label">Tanggal (hari ke-1)</label><input className="form-control" type="date" value={f.date} onChange={set('date')}/></div>
      <div className="s2"><label className="form-label">Waktu</label><input className="form-control" type="time" value={f.time} onChange={set('time')}/></div>
      <div className="s2"><label className="form-label">Nama tempat</label><input className="form-control" placeholder="Contoh: Aula Gedung A" value={f.location} onChange={set('location')}/></div>
      <div className="s2"><label className="form-label" htmlFor="d2">Tanggal hari ke-2</label><input id="d2" className="form-control" type="date" min={f.date || undefined} value={f.date2 || ''} onChange={set('date2')}/></div>
      <div className="s4 align-self-end"><div className="form-text mb-1">Isi bila kegiatan berlangsung 2 hari, kosongkan bila hanya 1 hari. Satu QR dipakai di kedua hari dan dipindai satu kali setiap hari. Jam dan tempat dianggap sama.</div></div>
      <div className="s6"><label className="form-label">Sesuaikan titik lokasi di peta *</label>
        <Suspense fallback={<Skel h="22rem" r="12px"/>}><MapPicker lat={has ? f.lat : NaN} lng={has ? f.lng : NaN} onChange={pick}/></Suspense></div>
      <div className="s6"><label htmlFor="maps" className="form-label">Tautan Google Maps (terisi otomatis dari titik di atas)</label>
        <div className="input-group"><span className="input-group-text"><i className="bi bi-geo-alt-fill"/></span>
          <input id="maps" className={'form-control' + (f.mapsUrl && !maps ? ' is-invalid' : maps ? ' is-valid' : '')} inputMode="url" autoComplete="off" placeholder="Atau tempel tautan Google Maps / koordinat -6.9175, 107.6191" value={f.mapsUrl} onChange={paste}/>
          {maps && <a className="btn btn-outline-primary" href={maps} target="_blank" rel="noopener noreferrer">Uji di Google Maps</a>}
          {f.mapsUrl && !maps && <div className="invalid-feedback">Bukan tautan Google Maps yang valid. Gunakan peta di atas, atau tombol Bagikan di Google Maps.</div>}</div>
        <div className="form-text">Titik ini yang dikirim ke peserta lewat WhatsApp dan halaman tiket. Bila Anda menempel tautan pendek (maps.app.goo.gl), pin di peta dihapus karena koordinatnya tidak bisa dibaca, tetapi tautannya tetap dipakai. Gunakan <b>Uji di Google Maps</b> untuk memastikan titiknya benar.</div></div>
      <div className="s6"><label className="form-label">Deskripsi</label><textarea className="form-control" rows="3" value={f.description} onChange={set('description')}/></div>
      <div className="s6"><button className="btn btn-primary">Simpan</button></div></form>}</>
}
