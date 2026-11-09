import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { auth, db } from './firebase'
export function useCol(name, order) {
  const [rows, setRows] = useState([])
  useEffect(() => onSnapshot(order ? query(collection(db, name), orderBy(order, 'desc')) : collection(db, name),
    s => setRows(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => console.error(`Gagal membaca koleksi ${name}:`, e.code, e.message)), [name, order])
  return rows
}
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
