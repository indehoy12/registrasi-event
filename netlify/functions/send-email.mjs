// Mengirim tiket lewat email (Gmail SMTP). Isi pesan sama persis dengan WhatsApp; QR dilampirkan sebagai gambar.
// Environment variable Netlify: GMAIL_USER (alamat Gmail pengirim), GMAIL_APP_PASSWORD (sandi aplikasi 16 karakter), MAIL_FROM_NAME (opsional).
import nodemailer from 'nodemailer'
import QRCode from 'qrcode'
import { json, siapkan, tandaiTiket, isiPesan, untukTeksBiasa, untukHtml, PERINGATAN_STATUS } from '../lib/common.mjs'

export default async (req) => {
 const { err, data } = await siapkan(req, ['GMAIL_USER', 'GMAIL_APP_PASSWORD']); if (err) return err
  const { idToken, ticketId, pf, sf, maps, base } = data
  const to = (pf.email?.stringValue || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(to)) return json({ error: 'Email peserta kosong atau tidak valid.' }, 400)

  const { teks, title } = isiPesan({ pf, sf, maps, base, ticketId, adaGambar: true })
  const qr = await QRCode.toBuffer(ticketId, { width: 700, margin: 2 })
  // Bersihkan isian dari spasi, tanda kutip, dan karakter tak terlihat yang sering ikut tersalin.
  const user = process.env.GMAIL_USER.trim().replace(/^["']|["']$/g, '').trim(), dari = process.env.MAIL_FROM_NAME || `Panitia ${title}`
  const pass = process.env.GMAIL_APP_PASSWORD.replace(/[^A-Za-z0-9]/g, '')
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(user)) return json({ error: 'GMAIL_USER bukan alamat email lengkap (contoh: panitia@gmail.com).' }, 500)
  if (pass.length !== 16) return json({ error: `GMAIL_APP_PASSWORD berisi ${pass.length} karakter, seharusnya 16. Kemungkinan itu bukan Sandi Aplikasi (buat di myaccount.google.com/apppasswords).` }, 500)
  const smtp = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } })
  try {
    await smtp.sendMail({
      from: { name: dari, address: user }, to, replyTo: user,
      subject: `Tiket ${title} - ${pf.name?.stringValue || ''}`.trim(),
      text: untukTeksBiasa(teks), html: untukHtml(teks, { cid: 'qr-tiket' }),
      attachments: [{ filename: 'tiket-qr.png', content: qr, contentType: 'image/png', cid: 'qr-tiket' }],
    })
  } catch (e) {
    const login = /Invalid login|Username and Password|EAUTH/i.test(String(e.message) + (e.code || ''))
    console.error('send-email gagal:', e.code, e.responseCode, e.response)
    return json({ error: login ? `Login Gmail ditolak untuk ${user} (${e.responseCode || e.code || 'tanpa kode'}: ${String(e.response || e.message).slice(0, 140)}). Periksa bahwa sandi dibuat oleh akun ${user} sendiri dan berupa Sandi Aplikasi, bukan sandi akun.` : `Email gagal terkirim: ${e.message}` }, 502)
  }
  const tersimpan = await tandaiTiket(idToken, ticketId, { emailSentAt: { timestampValue: new Date().toISOString() } })
  return json({ ok: true, ...(tersimpan ? {} : { warn: PERINGATAN_STATUS }) })
}
