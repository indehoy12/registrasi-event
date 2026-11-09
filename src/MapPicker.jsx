import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'; import 'leaflet/dist/leaflet.css'

const pin = L.divIcon({ className: 'pin', html: '<i class="bi bi-geo-alt-fill"></i>', iconSize: [40, 40], iconAnchor: [20, 38] })
const r6 = (n) => +n.toFixed(6)

// Peta untuk menyesuaikan titik lokasi: sentuh peta, geser pin, cari nama tempat, atau pakai lokasi saat ini.
export default function MapPicker({ lat, lng, onChange }) {
  const el = useRef(), map = useRef(), mk = useRef(), cb = useRef(onChange); cb.current = onChange
  const [q, setQ] = useState(''), [hits, setHits] = useState([]), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [locating, setLocating] = useState(false)
  const has = Number.isFinite(lat) && Number.isFinite(lng)

  useEffect(() => {
    const m = L.map(el.current).setView(has ? [lat, lng] : [-2.5, 118], has ? 17 : 5)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m)
    m.on('click', e => cb.current(r6(e.latlng.lat), r6(e.latlng.lng)))
    map.current = m
    return () => { m.remove(); map.current = null; mk.current = null }
  }, [])

  useEffect(() => {
    const m = map.current; if (!m) return
    if (!has) { mk.current?.remove(); mk.current = null; return }
    if (!mk.current) {
      mk.current = L.marker([lat, lng], { icon: pin, draggable: true, keyboard: true, title: 'Geser untuk menyesuaikan titik' }).addTo(m)
      mk.current.on('dragend', () => { const p = mk.current.getLatLng(); cb.current(r6(p.lat), r6(p.lng)) })
    } else mk.current.setLatLng([lat, lng])
    if (!m.getBounds().contains([lat, lng])) m.setView([lat, lng], Math.max(m.getZoom(), 16))
  }, [lat, lng])

  // Cari tempat langsung saat mengetik (jeda 0,6 detik agar tidak membebani layanan pencarian)
  useEffect(() => {
    const s = q.trim(); if (s.length < 3) { setHits([]); setMsg(''); return }
    const t = setTimeout(async () => {
      setBusy(true)
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=id&q=${encodeURIComponent(s)}`)
        const j = await r.json(); setHits(j.map(x => ({ name: x.display_name, lat: +x.lat, lng: +x.lon })))
        setMsg(j.length ? '' : 'Tempat tidak ditemukan. Coba kata kunci lain, atau sentuh langsung di peta.')
      } catch { setMsg('Pencarian tempat sedang tidak tersedia. Sentuh langsung di peta.') }
      setBusy(false)
    }, 600)
    return () => clearTimeout(t)
  }, [q])

  const pick = (h) => { cb.current(r6(h.lat), r6(h.lng)); map.current?.setView([h.lat, h.lng], 17); setHits([]); setQ('') }
  const here = () => {
    if (!navigator.geolocation) return setMsg('Perangkat ini tidak mendukung lokasi.')
    setMsg('')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(p => { setLocating(false); pick({ lat: p.coords.latitude, lng: p.coords.longitude }) },
      () => { setLocating(false); setMsg('Izin lokasi ditolak atau lokasi tidak ditemukan. Gunakan pencarian atau sentuh peta.') }, { enableHighAccuracy: true, timeout: 10000 })
  }

  return <div>
    <div className="input-group mb-2">
      <span className="input-group-text"><i className="bi bi-search"/></span>
      <input className="form-control" type="search" autoComplete="off" placeholder="Cari nama tempat atau alamat" aria-label="Cari tempat" value={q} onChange={e => setQ(e.target.value)}/>
      <button type="button" className={'btn btn-outline-primary' + (locating ? ' is-busy' : '')} aria-busy={locating} disabled={locating} onClick={here} title="Pakai lokasi saya"><i className="bi bi-crosshair"/> Lokasi saya</button>
    </div>
    {(busy || hits.length > 0) && <div className="hits mb-2" role="listbox" aria-label="Hasil pencarian tempat">
      {busy && !hits.length && <span className="skel" style={{ height: '3rem', borderRadius: 12 }}/>}
      {hits.map((h, i) => <button type="button" role="option" className="hit aktif" key={i} onClick={() => pick(h)}><span className="flex-fill text-start small">{h.name}</span><span className="hit-go"><i className="bi bi-pin-map"/> Pilih</span></button>)}</div>}
    {msg && <div className="small text-muted mb-2" role="status">{msg}</div>}
    <div ref={el} className="map-pick" role="application" aria-label="Peta untuk menyesuaikan titik lokasi"/>
    <div className="form-text">{has ? <>Titik saat ini: <b>{lat}, {lng}</b>. Geser pin atau sentuh tempat lain di peta untuk menyesuaikan.</> : 'Belum ada titik. Cari nama tempat, pakai lokasi saya, atau sentuh peta di lokasi acara.'}</div>
  </div>
}
