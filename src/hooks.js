import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore'
import { auth, db } from './firebase'
// Data langsung (realtime): berubah otomatis tanpa refresh. Mengembalikan [rows, loading] untuk tampilan skeleton.
export function useColState(name, order) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true)
  useEffect(() => onSnapshot(order ? query(collection(db, name), orderBy(order, 'desc')) : collection(db, name),
    s => { setRows(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
    e => { console.error(`Gagal membaca koleksi ${name}:`, e.code, e.message); setLoading(false) }), [name, order])
  return [rows, loading]
}
export const useCol = (name, order) => useColState(name, order)[0]
export const fmt = (t) => t?.toDate ? t.toDate().toLocaleString('id-ID') : (t || '')
export const waNumber = (n = '') => { const d = String(n).replace(/\D/g, ''); return d.startsWith('0') ? '62' + d.slice(1) : d.startsWith('8') ? '62' + d : d }
export const validWa = (n) => /^62\d{8,13}$/.test(n)
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(e)
export const ticketLink = (id) => `${location.origin}/tiket/${id}`
export const wait = (ms) => new Promise(r => setTimeout(r, ms))
// Memicu pengiriman tiket lewat Netlify Function; mengembalikan { via: 'fonnte-gambar' | 'fonnte', note }
export async function sendTicketWA(ticketId) {
  const r = await fetch('/.netlify/functions/send-wa', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }, body: JSON.stringify({ ticketId }) })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Gagal mengirim.'); return j
}
export const tgl = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
export const maskWa = (n = '') => { const d = waNumber(n); return d.length > 7 ? '+' + d.slice(0, 4) + '•'.repeat(d.length - 7) + d.slice(-3) : '' }
export const maskEmail = (e = '') => { const [u, h] = String(e).split('@'); return h ? u.slice(0, 2) + '•••@' + h : '' }
// Nomor tiket pendek (8 karakter) yang tampil di tiket peserta; dipakai untuk input manual oleh petugas.
export const ticketCode = (id = '') => String(id).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase()
export const showCode = (id) => { const c = ticketCode(id); return c.length === 8 ? c.slice(0, 4) + ' ' + c.slice(4) : c }
// Penyamaan karakter yang mirip (O/0, I/L/1) agar salah ketik tidak menggagalkan pencarian
export const normCode = (s = '') => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
// Menerima isi QR, tautan tiket, atau nomor tiket. Mengembalikan { token } (kode panjang) atau { code } (8 karakter) atau { error }.
export const parseTicketInput = (raw = '') => {
  let s = String(raw).trim(); if (!s) return { error: 'Ketik nomor tiket terlebih dahulu.' }
  const m = s.match(/\/tiket\/([\w-]+)/); if (m) s = m[1]
  s = s.replace(/[?#].*$/, '')
  if (/^[\w-]{16,80}$/.test(s)) return { token: s }
  const c = normCode(s)
  if (c.length !== 8) return { error: 'Nomor tiket terdiri dari 8 huruf/angka, contoh: RHEH NH0K.' }
  return { code: c }
}
export const jam = (t) => t?.toDate ? t.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.') : ''
<<<<<<< HEAD

// Titik lokasi Google Maps: terima tautan resmi Google Maps (termasuk maps.app.goo.gl) atau koordinat "lat,lng"; selain itu ditolak.
export function normMaps(v = '') {
  const s = String(v).trim(); if (!s) return ''
  const ll = s.match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (ll) return Math.abs(+ll[1]) <= 90 && Math.abs(+ll[2]) <= 180 ? mapsLink(+ll[1], +ll[2]) : ''
  try {
    const u = new URL(s); if (u.protocol !== 'https:') return ''
    const host = u.hostname.replace(/^www\./, '')
    const short = ['maps.app.goo.gl', 'goo.gl', 'g.co', 'maps.google.com'].includes(host)
    const gmaps = /^google\.(com|co\.id|[a-z]{2})$/.test(host) && u.pathname.startsWith('/maps')
    return short || gmaps ? u.href : ''
  } catch { return '' }
}
// Info seminar secara langsung; mapsOk = titik lokasi sudah diisi dan valid
export function useSeminar() {
  const [sem, setSem] = useState({}), [loaded, setLoaded] = useState(false)
  useEffect(() => onSnapshot(doc(db, 'seminar', 'main'), s => { setSem(s.exists() ? s.data() : {}); setLoaded(true) }, () => setLoaded(true)), [])
  return { sem, loaded, mapsOk: !!normMaps(sem.mapsUrl) }
}

// Tautan Google Maps resmi untuk sebuah koordinat, dan kebalikannya (membaca koordinat dari tautan panjang Google Maps)
export const mapsLink = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
export function coordsFromMaps(v = '') {
  const m = String(v).match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || String(v).match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || String(v).match(/[?&](?:q|query|ll)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i)
  return m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180 ? { lat: +m[1], lng: +m[2] } : null
}
=======
>>>>>>> 81c392ca076f8f4a1e06897c9f6643caf77f7dde
