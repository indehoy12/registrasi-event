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
  const user = process.env.GMAIL_USER, dari = process.env.MAIL_FROM_NAME || `Panitia ${title}`
  const smtp = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') } })
  try {
    await smtp.sendMail({
      from: { name: dari, address: user }, to, replyTo: user,
      subject: `Tiket ${title} - ${pf.name?.stringValue || ''}`.trim(),
      text: untukTeksBiasa(teks), html: untukHtml(teks, { cid: 'qr-tiket' }),
      attachments: [{ filename: 'tiket-qr.png', content: qr, contentType: 'image/png', cid: 'qr-tiket' }],
    })
  } catch (e) {
    const login = /Invalid login|Username and Password|EAUTH/i.test(String(e.message) + (e.code || ''))
    return json({ error: login ? 'Login Gmail ditolak. Periksa GMAIL_USER dan GMAIL_APP_PASSWORD (harus Sandi Aplikasi, bukan sandi akun).' : `Email gagal terkirim: ${e.message}` }, 502)
  }
  const tersimpan = await tandaiTiket(idToken, ticketId, { emailSentAt: { timestampValue: new Date().toISOString() } })
  return json({ ok: true, ...(tersimpan ? {} : { warn: PERINGATAN_STATUS }) })
}
