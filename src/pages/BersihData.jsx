import { useState } from 'react'
import { addDoc, collection, deleteField, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useColState, useJagaProses } from '../hooks'
import { resetKehadiran, hapusSemua } from '../bersih'

const fs = { addDoc, collection, deleteField, doc, getDocs, serverTimestamp, writeBatch }
const KATA = 'HAPUS'
const MODE = {
  hadir: { judul: 'Reset kehadiran', tombol: 'Reset kehadiran…', ikon: 'arrow-counterclockwise', jalan: resetKehadiran,
    info: 'Menghapus semua catatan check-in dan mengembalikan semua tiket ke status belum hadir. Peserta dan tiket tetap ada (termasuk status terkirim), jadi tidak perlu import atau kirim ulang. Cocok setelah uji coba scan.',
    hasil: (r) => `${r.checkin} catatan check-in dihapus dan ${r.tiket} tiket dikembalikan ke status belum hadir.` },
  semua: { judul: 'Hapus semua data peserta', tombol: 'Hapus semua data…', ikon: 'trash3', jalan: hapusSemua,
    info: 'Menghapus SEMUA peserta, tiket, dan catatan check-in. Informasi seminar, akun, dan audit log tidak ikut terhapus. Tautan atau QR tiket yang pernah dikirim tidak akan berlaku lagi. Cocok untuk membersihkan data uji sebelum mengimport peserta asli.',
    hasil: (r) => `${r.peserta} peserta, ${r.tiket} tiket, dan ${r.checkin} catatan check-in dihapus.` },
}

export default function BersihData() {
  const [ps] = useColState('participants'), [ts] = useColState('tickets'), [cs] = useColState('checkins')
  const [mode, setMode] = useState(null), [kata, setKata] = useState(''), [busy, setBusy] = useState(false), [prog, setProg] = useState(''), [hasil, setHasil] = useState(null), [err, setErr] = useState('')
  useJagaProses(busy)
  const adaHadir = cs.length > 0 || ts.some(t => t.usedDays != null || t.usedAt != null || t.status === 'terpakai'), adaData = ps.length + ts.length + cs.length > 0
  const buka = (m) => { setMode(m); setKata(''); setErr(''); setHasil(null) }
  const jalankan = async () => {
    setBusy(true); setErr(''); setHasil(null); const m = mode
    try { const r = await MODE[m].jalan(fs, db, auth.currentUser.email, (a, b) => setProg(`${a} dari ${b} operasi selesai.`)); setHasil({ teks: MODE[m].hasil(r) }); setMode(null); setKata('') }
    catch (ex) { setErr(ex.code === 'permission-denied'
      ? 'Ditolak oleh aturan Firestore (permission-denied). Pastikan firestore.rules terbaru sudah di-Publish; aturan hapus tiket baru ditambahkan untuk fitur ini.'
      : 'Gagal: ' + (ex.code || '') + ' ' + (ex.message || ex) + '. Sebagian data mungkin sudah terhapus; jalankan lagi untuk menyelesaikannya.') }
    finally { setBusy(false); setProg('') }
  }
  return <section className="card border-danger mt-4" aria-labelledby="bd-t"><div className="card-body">
    <h2 id="bd-t" className="h5 text-danger mb-1"><i className="bi bi-exclamation-triangle me-2"/>Bersihkan data uji</h2>
    <p className="small text-muted mb-2">Gunakan setelah uji coba dan sebelum import peserta asli. Jangan dijalankan saat acara berlangsung. Tindakan ini tidak bisa dibatalkan.</p>
    <p className="mb-3" aria-live="polite"><b>Data saat ini:</b> {ps.length} peserta · {ts.length} tiket · {cs.length} catatan check-in</p>
    <div className="d-flex gap-2 flex-wrap">{Object.entries(MODE).map(([k, m]) =>
      <button key={k} className={'btn btn-sm ' + (mode === k ? 'btn-danger' : 'btn-outline-danger')} disabled={busy || (k === 'hadir' ? !adaHadir : !adaData)} onClick={() => buka(k)}><i className={`bi bi-${m.ikon} me-1`}/>{m.tombol}</button>)}</div>
    {mode && <div className="border border-danger-subtle rounded p-3 mt-3">
      <p className="mb-2"><b>{MODE[mode].judul}.</b> {MODE[mode].info}</p>
      <label className="form-label small mb-1" htmlFor="bd-kata">Ketik <b>{KATA}</b> untuk melanjutkan:</label>
      <div className="d-flex gap-2 flex-wrap"><input id="bd-kata" className="form-control form-control-sm w-auto" value={kata} onChange={e => setKata(e.target.value)} autoComplete="off" placeholder={KATA} disabled={busy}/>
        <button className={'btn btn-danger btn-sm' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={busy || kata.trim().toUpperCase() !== KATA} onClick={jalankan}>Ya, jalankan</button>
        <button className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => setMode(null)}>Batal</button></div>
      {busy && <div className="small text-muted mt-2" role="status">Sedang memproses. Jangan tutup halaman ini. {prog}</div>}
    </div>}
    {err && <div className="alert alert-danger mt-3 mb-0" role="alert">{err}</div>}
    {hasil && <div className="alert alert-success mt-3 mb-0" role="status"><b>Selesai.</b> {hasil.teks}</div>}
  </div></section>
}
