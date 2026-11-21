// Pembersihan data uji coba. Pustaka Firestore diberikan lewat parameter `fs` supaya logikanya bisa diuji tanpa Firebase.
// Data diambil ulang dari server saat dijalankan (bukan dari daftar di layar), jadi hasilnya lengkap, dan aman diulang bila proses sempat terputus.
const UKURAN = 400   // satu batch Firestore maksimal 500 operasi

const ambil = async (fs, db, nama) => (await fs.getDocs(fs.collection(db, nama))).docs.map(d => ({ id: d.id, ...d.data() }))
const hapusDoc = (fs, db, koleksi, id) => (b) => b.delete(fs.doc(db, koleksi, id))
// Tiket yang pernah dipindai: peta usedDays (cara sekarang), usedAt/usedBy, atau status "terpakai" (cara lama)
const pernahDipakai = (t) => t.usedDays != null || t.usedAt != null || t.usedBy != null || t.status === 'terpakai'

async function tulis(fs, db, ops, onProgress) {
  for (let i = 0; i < ops.length; i += UKURAN) {
    const b = fs.writeBatch(db); ops.slice(i, i + UKURAN).forEach(o => o(b)); await b.commit()
    onProgress?.(Math.min(i + UKURAN, ops.length), ops.length)
  }
}
async function catat(fs, db, aktor, action) {
  try { await fs.addDoc(fs.collection(db, 'auditLogs'), { at: fs.serverTimestamp(), actor: aktor, action, participant: null, representative: null }) }
  catch { /* gagal mencatat tidak membatalkan pembersihan yang sudah selesai */ }
}

// Hapus semua catatan check-in dan kembalikan tiket ke "belum hadir". Peserta dan tiket (termasuk status terkirim) tetap.
// Check-in dihapus lebih dulu: bila terputus di tengah, tiket yang tersisa tetap tertanda "sudah hadir" sehingga tidak bisa tercatat dobel; ulangi saja.
export async function resetKehadiran(fs, db, aktor, onProgress) {
  const [checkins, tickets] = await Promise.all([ambil(fs, db, 'checkins'), ambil(fs, db, 'tickets')])
  const dipakai = tickets.filter(pernahDipakai)
  await tulis(fs, db, [
    ...checkins.map(c => hapusDoc(fs, db, 'checkins', c.id)),
    ...dipakai.map(t => (b) => b.update(fs.doc(db, 'tickets', t.id), { usedDays: fs.deleteField(), usedAt: fs.deleteField(), usedBy: fs.deleteField(), status: t.status === 'dicabut' ? 'dicabut' : 'aktif' }))
  ], onProgress)
  await catat(fs, db, aktor, `reset kehadiran (${checkins.length} check-in dihapus, ${dipakai.length} tiket dikembalikan)`)
  return { checkin: checkins.length, tiket: dipakai.length }
}

// Hapus SEMUA peserta, tiket, dan check-in. Informasi seminar, akun, dan audit log tidak disentuh.
// Urutan check-in, tiket, peserta: bila terputus, tidak ada tiket aktif tanpa pemilik yang tertinggal; ulangi saja.
export async function hapusSemua(fs, db, aktor, onProgress) {
  const [checkins, tickets, peserta] = await Promise.all([ambil(fs, db, 'checkins'), ambil(fs, db, 'tickets'), ambil(fs, db, 'participants')])
  await tulis(fs, db, [
    ...checkins.map(c => hapusDoc(fs, db, 'checkins', c.id)),
    ...tickets.map(t => hapusDoc(fs, db, 'tickets', t.id)),
    ...peserta.map(p => hapusDoc(fs, db, 'participants', p.id))
  ], onProgress)
  await catat(fs, db, aktor, `hapus semua data (${peserta.length} peserta, ${tickets.length} tiket, ${checkins.length} check-in)`)
  return { peserta: peserta.length, tiket: tickets.length, checkin: checkins.length }
}
