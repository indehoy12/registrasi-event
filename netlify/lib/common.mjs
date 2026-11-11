// Bagian bersama untuk pengiriman tiket lewat WhatsApp dan email: pemeriksaan login, pengambilan data, dan isi pesan.
// Isi pesan dibuat di satu tempat ini, jadi WhatsApp dan email selalu sama.
const API = process.env.FB_API_KEY, PID = process.env.FB_PROJECT_ID
export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } })
export const fsr = (p, idToken, init = {}) => fetch(`https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents/${p}`,
  { ...init, headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' } })

// Memeriksa pemanggil (admin/superadmin aktif) lalu mengambil tiket, peserta, dan info seminar.
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
  if (!t.ok) return { err: json({ error: 'Tiket tidak ditemukan.' }, 404) }
  const tf = (await t.json()).fields
  if (tf.status?.stringValue !== 'aktif') return { err: json({ error: 'Tiket tidak aktif.' }, 400) }
  const p = await fsr(`participants/${tf.participantId?.stringValue}`, idToken)
  if (!p.ok) return { err: json({ error: 'Data peserta tidak ditemukan.' }, 404) }
  const pf = (await p.json()).fields
  const sm = await fsr('seminar/main', idToken), sf = sm.ok ? (await sm.json()).fields || {} : {}
  const maps = sf.mapsUrl?.stringValue || ''
  if (!/^https:\/\//.test(maps)) return { err: json({ error: 'Titik lokasi Google Maps belum diisi. Isi di menu Informasi seminar sebelum mengirim tiket.' }, 400) }
  const base = (process.env.SITE_URL || process.env.URL || new URL(req.url).origin).replace(/\/$/, '')
  return { data: { idToken, ticketId, pf, sf, maps, base } }
}

// Mencatat status kirim di tiket. Dicoba 2 kali; mengembalikan true/false agar pemanggil tahu bila status gagal tersimpan
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
const tgl = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('id-ID', { dateStyle: 'full', timeZone: 'UTC' })

// Isi pesan (sama untuk WhatsApp dan email). Mengembalikan teks dengan penanda tebal.
export function isiPesan({ pf, sf, maps, base, ticketId, adaGambar }) {
  const title = sf.title?.stringValue || 'Seminar', time = sf.time?.stringValue, place = sf.location?.stringValue
  const d1 = sf.date?.stringValue, d2 = sf.date2?.stringValue
  const link = `${base}/tiket/${ticketId}`
  const c8 = ticketId.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase(), nomor = c8.slice(0, 4) + ' ' + c8.slice(4)
  const detail = [
    ...(d2 ? [d1 && `Hari ke-1 : ${tgl(d1)}`, `Hari ke-2 : ${tgl(d2)}`] : [d1 && `Hari/Tanggal : ${tgl(d1)}`]),
    time && `Waktu : pukul ${time.replace(':', '.')}`, place && `Tempat : ${place}`].filter(Boolean)
  const teks = [
    `Yth. Bapak/Ibu ${pf.name?.stringValue || ''},`,
    '',
    'Dengan hormat, kami mengundang Bapak/Ibu untuk hadir pada kegiatan:',
    '',
    `${B1}${title}${B2}`,
    ...detail,
    '',
    'Titik lokasi (Google Maps):',
    maps,
    '',
    adaGambar
      ? 'Sebagai tanda masuk, kami sampaikan tiket elektronik berupa kode QR yang terlampir pada pesan ini. Mohon menunjukkan kode QR tersebut kepada petugas pada saat kedatangan.'
      : 'Sebagai tanda masuk, kami sampaikan tiket elektronik berupa kode QR yang dapat dibuka melalui tautan berikut. Mohon menunjukkannya kepada petugas pada saat kedatangan:',
    ...(adaGambar ? ['', 'Apabila kode QR tidak tampil, tiket dapat dibuka melalui tautan berikut:'] : []),
    link,
    '',
    `Nomor tiket: ${B1}${nomor}${B2} (sebutkan kepada petugas apabila kode QR tidak dapat dipindai).`,
    '',
    d2 ? 'Kode QR yang sama dipakai pada kedua hari kegiatan, dan dipindai satu kali setiap hari. Apabila Bapak/Ibu berhalangan hadir, tiket dapat diwakilkan kepada orang lain dengan menunjukkan kode QR ini kepada petugas dan menyebutkan nama perwakilan.'
       : 'Kode QR ini berlaku untuk satu kali registrasi. Apabila Bapak/Ibu berhalangan hadir, tiket dapat diwakilkan kepada orang lain dengan menunjukkan kode QR ini kepada petugas dan menyebutkan nama perwakilan.',
    '',
    'Atas perhatian dan kehadiran Bapak/Ibu, kami ucapkan terima kasih.',
    '',
    'Hormat kami,',
    `Panitia ${title}`,
  ].join('\n')
  return { teks, title, link, nomor }
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
    + (cid ? `<p style="text-align:center;margin:0 0 16px"><img src="cid:${cid}" width="260" height="260" alt="Kode QR tiket" style="border:1px solid #e4e7ec;border-radius:12px"></p>` : '') + body + '</div>'
}
