// Bagian bersama untuk pengiriman undangan lewat WhatsApp dan email: pemeriksaan login, pengambilan data, dan isi pesan.
// Isi email dibuat di satu tempat ini (isiPesan). WhatsApp hanya berisi pemberitahuan yang mengarahkan peserta ke emailnya (isiPesanArahEmail);
// undangan dan QR-nya ada di email.
const API = process.env.FB_API_KEY, PID = process.env.FB_PROJECT_ID
export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } })
export const fsr = (p, idToken, init = {}) => fetch(`https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents/${p}`,
  { ...init, headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' } })

// Memeriksa pemanggil (admin/superadmin aktif) lalu mengambil undangan, peserta, dan info seminar.
// Mengembalikan { err: Response } bila ada yang tidak beres, atau { data } bila siap dipakai.
export async function siapkan(req, perluKonfigurasi = []) {
  if (req.method !== 'POST') return { err: json({ error: 'Metode tidak didukung.' }, 405) }
  if (!API || !PID || perluKonfigurasi.some(k => !process.env[k])) return { err: json({ error: `Konfigurasi server belum lengkap (FB_API_KEY, FB_PROJECT_ID${perluKonfigurasi.length ? ', ' + perluKonfigurasi.join(', ') : ''}).` }, 500) }
  const idToken = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  const { ticketId } = await req.json().catch(() => ({}))
  if (!idToken || !/^[\w-]{16,80}$/.test(ticketId || '')) return { err: json({ error: 'Permintaan tidak valid.' }, 400) }

  const lk = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) })
  if (!lk.ok) return { err: json({ error: 'Sesi login tidak valid. Silakan login ulang.' }, 401) }
  const uid = (await lk.json()).users?.[0]?.localId
  const u = await fsr(`users/${uid}`, idToken), ud = u.ok ? (await u.json()).fields : null
  if (!ud || ud.active?.booleanValue !== true || !['admin', 'superadmin'].includes(ud.role?.stringValue)) return { err: json({ error: 'Akses ditolak.' }, 403) }

  const t = await fsr(`tickets/${ticketId}`, idToken)
  if (!t.ok) return { err: json({ error: 'Undangan tidak ditemukan.' }, 404) }
  const tf = (await t.json()).fields
  if (tf.status?.stringValue !== 'aktif') return { err: json({ error: 'Undangan tidak aktif.' }, 400) }
  const p = await fsr(`participants/${tf.participantId?.stringValue}`, idToken)
  if (!p.ok) return { err: json({ error: 'Data peserta tidak ditemukan.' }, 404) }
  const pf = (await p.json()).fields
  const sm = await fsr('seminar/main', idToken), sf = sm.ok ? (await sm.json()).fields || {} : {}
  const maps = sf.mapsUrl?.stringValue || ''
  if (!/^https:\/\//.test(maps)) return { err: json({ error: 'Titik lokasi Google Maps belum diisi. Isi di menu Informasi seminar sebelum mengirim undangan.' }, 400) }
  const base = (process.env.SITE_URL || process.env.URL || new URL(req.url).origin).replace(/\/$/, '')
  return { data: { idToken, ticketId, pf, sf, maps, base } }
}

// Mencatat status kirim di undangan. Dicoba 2 kali; mengembalikan true/false agar pemanggil tahu bila status gagal tersimpan
// (pesan sudah terkirim, jadi jangan sampai dikirim ulang tanpa sadar).
export async function tandaiTiket(idToken, ticketId, fields) {
  const url = `tickets/${ticketId}?${Object.keys(fields).map(k => 'updateMask.fieldPaths=' + k).join('&')}`
  for (let i = 0; i < 2; i++) {
    try { const r = await fsr(url, idToken, { method: 'PATCH', body: JSON.stringify({ fields }) }); if (r.ok) return true } catch { /* coba lagi */ }
  }
  return false
}
export const PERINGATAN_STATUS = 'Pesan sudah terkirim, tetapi status "terkirim" gagal tersimpan. Jangan kirim ulang; cek langsung ke peserta bila ragu.'

const B1 = '\u0001', B2 = '\u0002'   // penanda teks tebal: WhatsApp = *teks*, email = <b>teks</b>
// Bila label batch otomatis ditambahkan, buang kata "Batch N" yang sudah ada di judul supaya tidak dobel ("... Batch 2 - Batch 2").
const bersihBatch = (t) => t.replace(/\s*[-\u2013\u2014(:]?\s*\bbatch\s*\d+\s*\)?/gi, '').replace(/\s{2,}/g, ' ').replace(/[\s\-\u2013\u2014:]+$/, '').trim() || t
// Sapaan: nama perusahaan diutamakan (tebal), lalu nama pimpinan. Tanpa nama perusahaan, kembali ke sapaan lama dengan nama PIC.
const sapaan = (pf) => {
  const usaha = (pf.institution?.stringValue || '').trim(), pimpinan = (pf.pimpinan?.stringValue || '').trim(), pic = (pf.name?.stringValue || '').trim()
  if (!usaha) return [`Yth. Bapak/Ibu ${pic},`]
  return ['Yth. Bapak/Ibu Pimpinan', `${B1}${usaha}${B2}`, ...(pimpinan ? [pimpinan] : [])]
}
const tgl = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('id-ID', { dateStyle: 'full', timeZone: 'UTC' })

// Isi pesan (sama untuk WhatsApp dan email). Mengembalikan teks dengan penanda tebal.
export function isiPesan({ pf, sf, maps, base, ticketId, adaGambar }) {
  const title0 = sf.title?.stringValue || 'Seminar', time = sf.time?.stringValue, place = sf.location?.stringValue
  const d1 = sf.date?.stringValue, d2 = sf.date2?.stringValue
  // Peserta berbeda tiap hari: kolom hari berisi "1" atau "2" = hanya hari itu; kosong atau "1,2" = kedua hari
  const hs = [...new Set((pf.hari?.stringValue || '').match(/[12]/g) || [])], satu = !!d2 && hs.length === 1, dua = !!d2 && !satu
  const dSatu = satu && hs[0] === '2' ? d2 : d1
  // Batch: peserta berkolom Hari 1 = Batch 1 (hari ke-1), Hari 2 = Batch 2 (hari ke-2)
  const batch = satu ? hs[0] : '', label = batch ? `Batch ${batch}` : ''
  const title = label ? bersihBatch(title0) : title0
  const timeEnd = sf.timeEnd?.stringValue, agenda = sf.agenda?.stringValue
  const jam = (x) => x.replace(':', '.')
  const waktu = time ? `pukul ${jam(time)}${timeEnd ? ' - ' + jam(timeEnd) : ''} WIB` : ''
  const link = `${base}/undangan/${ticketId}`
  const c8 = ticketId.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase(), nomor = c8.slice(0, 4) + ' ' + c8.slice(4)
  const detail = [
    ...(dua ? [d1 && `Hari ke-1 : ${tgl(d1)}`, `Hari ke-2 : ${tgl(d2)}`] : [dSatu && `Hari/Tanggal : ${tgl(dSatu)}`]),
    waktu && `Waktu : ${waktu}`, place && `Tempat : ${place}`, agenda && `Agenda : ${agenda}`].filter(Boolean)
  // Isi ringkas, mengikuti surat undangan: LULUS evaluasi, rincian kegiatan, lokasi, QR, lalu ketentuan singkat.
  const wakil = 'dan dapat diwakilkan dengan menyebutkan nama perwakilan kepada petugas'
  const ketentuan = label ? `Berlaku untuk 1 (satu) peserta pada ${label} (${tgl(dSatu)}), ${wakil}. Kehadiran menjadi salah satu pertimbangan penetapan Daftar Rekanan Mampu (DRM) PT Kawasan Industri Terpadu Batang.`
    : dua ? `Berlaku untuk 1 (satu) peserta di kedua hari (dipindai satu kali tiap hari), ${wakil}.`
    : `Berlaku untuk 1 (satu) peserta, satu kali registrasi, ${wakil}.`
  const teks = [
    ...sapaan(pf),
    '',
    label ? `Berdasarkan hasil evaluasi administrasi dan kualifikasi penyedia, perusahaan Bapak/Ibu dinyatakan ${B1}LULUS${B2} dan berhak mengikuti tahapan selanjutnya. Kami mengundang Bapak/Ibu hadir pada:` : 'Kami mengundang Bapak/Ibu hadir pada kegiatan:',
    '',
    `${B1}${title}${label ? ' - ' + label : ''}${B2}`,
    ...detail,
    '',
    'Lokasi (Google Maps):',
    maps,
    '',
    adaGambar
      ? 'Tunjukkan kode QR terlampir kepada petugas saat kedatangan. Jika QR tidak tampil, buka:'
      : 'Tunjukkan kode QR pada tautan berikut kepada petugas saat kedatangan:',
    link,
    '',
    'Jika QR tidak terbaca, sebutkan nama perusahaan kepada petugas.',
    '',
    ketentuan,
    '',
    'Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.',
    '',
    'Hormat kami,',
    'PT Kawasan Industri Terpadu Batang',
  ].join('\n')
  return { teks, title, link, nomor, label }
}
// Nama pengirim email: MAIL_FROM_NAME di Netlify, atau bawaan ini bila kosong.
export const namaPengirim = () => (process.env.MAIL_FROM_NAME || '').trim() || 'Panitia Procurement PT KITB 2026'
export const EMAIL_VALID = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/
// Email disamarkan di WhatsApp (bu***@gmail.com) supaya tidak terbuka penuh bila nomor HP ternyata milik orang lain.
export const samarkanEmail = (e = '') => { const [u, d] = String(e).trim().split('@'); return `${u.slice(0, u.length > 3 ? 2 : 1)}***@${d}` }
// Pesan WhatsApp singkat: mengarahkan peserta untuk membuka undangannya di email.
export function isiPesanArahEmail({ pf, sf, base, ticketId }) {
  const title0 = sf.title?.stringValue || 'Seminar', email = samarkanEmail(pf.email?.stringValue || '')
  const d1 = sf.date?.stringValue, d2 = sf.date2?.stringValue, hs = [...new Set((pf.hari?.stringValue || '').match(/[12]/g) || [])]
  const batch = d2 && hs.length === 1 ? hs[0] : '', label = batch ? `Batch ${batch}` : '', dB = batch === '2' ? d2 : d1
  const title = label ? bersihBatch(title0) : title0
  const jam = (x) => x.replace(':', '.'), time = sf.time?.stringValue, timeEnd = sf.timeEnd?.stringValue, place = sf.location?.stringValue
  // Pesan WhatsApp sengaja singkat: rincian lengkap dan QR ada di email.
  // Yang disebut di WhatsApp adalah NAMA pengirim email (sama dengan MAIL_FROM_NAME), bukan alamat Gmail-nya, supaya peserta tahu email mana yang dicari (termasuk di folder Spam).
  const dari = namaPengirim()
  const teks = [
    ...sapaan(pf),
    '',
    `Undangan ${B1}${title}${label ? ' - ' + label : ''}${B2} sudah kami kirim ke email ${email} dari ${dari}. Mohon cek kotak masuk atau folder Spam.`,
    '',
    `Mohon balas ${B1}Hadir${B2} bila undangan sudah diterima.`,
    '',
    `Terima kasih. Panitia ${title}`,
  ].join('\n')
  return { teks, title, label }
}
export const untukWA = (t) => t.replaceAll(B1, '*').replaceAll(B2, '*')
export const untukTeksBiasa = (t) => t.replaceAll(B1, '').replaceAll(B2, '')
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// Versi HTML sederhana (QR di atas, lalu isi pesan yang sama). Tautan dibuat bisa diklik.
export function untukHtml(t, { cid } = {}) {
  const body = t.split('\n\n').map(par => '<p style="margin:0 0 14px">' + esc(par).replace(/\n/g, '<br>')
    .replace(/https:\/\/[^\s<]+/g, u => `<a href="${u}" style="color:#0f766e">${u}</a>`)
    .replaceAll(B1, '<b>').replaceAll(B2, '</b>') + '</p>').join('')
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#18212f;max-width:560px">`
    + (cid ? `<p style="text-align:center;margin:0 0 16px"><img src="cid:${cid}" width="260" height="260" alt="Kode QR undangan" style="border:1px solid #e4e7ec;border-radius:12px"></p>` : '') + body + '</div>'
}
