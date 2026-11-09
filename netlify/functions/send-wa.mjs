// Mengirim tiket lewat Fonnte. Token Fonnte hanya ada di server (environment variable Netlify).
const API = process.env.FB_API_KEY, PID = process.env.FB_PROJECT_ID, FT = process.env.FONNTE_TOKEN
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } })
const fsr = (p, idToken, init = {}) => fetch(`https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents/${p}`,
  { ...init, headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' } })

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung.' }, 405)
  if (!API || !PID || !FT) return json({ error: 'Konfigurasi server belum lengkap (FB_API_KEY, FB_PROJECT_ID, FONNTE_TOKEN).' }, 500)
  const idToken = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  const { ticketId } = await req.json().catch(() => ({}))
  if (!idToken || !/^[\w-]{16,80}$/.test(ticketId || '')) return json({ error: 'Permintaan tidak valid.' }, 400)

  // 1. Pastikan pemanggil adalah pengguna Firebase yang sah
  const lk = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) })
  if (!lk.ok) return json({ error: 'Sesi login tidak valid. Silakan login ulang.' }, 401)
  const uid = (await lk.json()).users?.[0]?.localId

  // 2. Pastikan role admin/superadmin dan akun aktif
  const u = await fsr(`users/${uid}`, idToken), ud = u.ok ? (await u.json()).fields : null
  if (!ud || ud.active?.booleanValue !== true || !['admin', 'superadmin'].includes(ud.role?.stringValue)) return json({ error: 'Akses ditolak.' }, 403)

  // 3. Ambil tiket dan peserta (nomor dan pesan dibuat di server, bukan dari browser)
  const t = await fsr(`tickets/${ticketId}`, idToken)
  if (!t.ok) return json({ error: 'Tiket tidak ditemukan.' }, 404)
  const tf = (await t.json()).fields
  if (tf.status?.stringValue !== 'aktif') return json({ error: 'Tiket tidak aktif.' }, 400)
  const p = await fsr(`participants/${tf.participantId?.stringValue}`, idToken)
  if (!p.ok) return json({ error: 'Data peserta tidak ditemukan.' }, 404)
  const pf = (await p.json()).fields
  const wa = (pf.whatsapp?.stringValue || '').replace(/\D/g, '')
  if (!wa) return json({ error: 'Nomor WhatsApp peserta kosong.' }, 400)
  const target = wa.startsWith('0') ? '62' + wa.slice(1) : wa
  const base = (process.env.SITE_URL || process.env.URL || new URL(req.url).origin).replace(/\/$/, '')

  // Info seminar untuk isi pesan (dokumen ini boleh dibaca publik)
  const sm = await fsr('seminar/main', idToken), sf = sm.ok ? (await sm.json()).fields || {} : {}
  const title = sf.title?.stringValue || 'Seminar', time = sf.time?.stringValue, place = sf.location?.stringValue
  const date = sf.date?.stringValue ? new Date(sf.date.stringValue + 'T00:00:00Z').toLocaleDateString('id-ID', { dateStyle: 'full', timeZone: 'UTC' }) : ''
  const link = `${base}/tiket/${ticketId}`
  const detail = [date && `Hari/Tanggal : ${date}`, time && `Waktu : pukul ${time.replace(':', '.')}`, place && `Tempat : ${place}`].filter(Boolean)
  const susun = (adaGambar) => [
    `Yth. Bapak/Ibu ${pf.name?.stringValue || ''},`,
    '',
    'Dengan hormat, kami mengundang Bapak/Ibu untuk hadir pada kegiatan:',
    '',
    `*${title}*`,
    ...detail,
    '',
    adaGambar
      ? 'Sebagai tanda masuk, kami sampaikan tiket elektronik berupa kode QR yang terlampir pada pesan ini. Mohon menunjukkan kode QR tersebut kepada petugas pada saat kedatangan.'
      : 'Sebagai tanda masuk, kami sampaikan tiket elektronik berupa kode QR yang dapat dibuka melalui tautan berikut. Mohon menunjukkannya kepada petugas pada saat kedatangan:',
    ...(adaGambar ? ['', 'Apabila kode QR tidak tampil, tiket dapat dibuka melalui tautan berikut:'] : []),
    link,
    '',
    'Kode QR ini hanya berlaku untuk satu orang. Mohon tidak membagikannya kepada pihak lain.',
    '',
    'Atas perhatian dan kehadiran Bapak/Ibu, kami ucapkan terima kasih.',
    '',
    'Hormat kami,',
    `Panitia ${title}`,
  ].join('\n')

  // 4. Kirim lewat Fonnte: coba gambar QR dulu (paket Super ke atas), jika ditolak kirim tautan saja
  const kirim = async (message, extra) => { const r = await fetch('https://api.fonnte.com/send', { method: 'POST', headers: { Authorization: FT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, message, countryCode: '62', ...extra }) }); const d = await r.json().catch(() => ({})); return { ok: r.ok && d.status !== false, reason: d.reason } }
  let via = 'fonnte-gambar', note = '', res = await kirim(susun(true), { url: `${base}/qr/${ticketId}.png` })
  if (!res.ok) { note = res.reason || 'gambar ditolak'; via = 'fonnte'; res = await kirim(susun(false), {}) }
  if (!res.ok) return json({ error: `Fonnte: ${res.reason || 'gagal mengirim'}` }, 502)

  await fsr(`tickets/${ticketId}?updateMask.fieldPaths=sentAt&updateMask.fieldPaths=sentVia`, idToken,
    { method: 'PATCH', body: JSON.stringify({ fields: { sentAt: { timestampValue: new Date().toISOString() }, sentVia: { stringValue: via } } }) })
  return json({ ok: true, via, note })
}
