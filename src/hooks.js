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
// Memicu pengiriman tiket (gambar QR + info seminar) lewat Netlify Function; mengembalikan 'fonnte-gambar' atau 'fonnte'
export async function sendTicketWA(ticketId) {
  const r = await fetch('/.netlify/functions/send-wa', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }, body: JSON.stringify({ ticketId }) })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Gagal mengirim.'); return j.via
}
