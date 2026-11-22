// Mengirim tiket lewat WhatsApp (Fonnte). Token Fonnte hanya ada di server (environment variable Netlify).
import { json, siapkan, tandaiTiket, isiPesan, isiPesanArahEmail, untukWA, EMAIL_VALID, PERINGATAN_STATUS } from '../lib/common.mjs'
const FT = process.env.FONNTE_TOKEN

export default async (req) => {
  const { err, data } = await siapkan(req, ['FONNTE_TOKEN']); if (err) return err
  const { idToken, ticketId, pf, sf, maps, base, tiketPenuh } = data
  const wa = (pf.whatsapp?.stringValue || '').replace(/\D/g, '')
  if (!wa) return json({ error: 'Nomor WhatsApp peserta kosong.' }, 400)
  const target = (wa.startsWith('620') ? '62' + wa.slice(3) : wa.startsWith('0') ? '62' + wa.slice(1) : wa.startsWith('8') ? '62' + wa : wa)
  if (!/^628\d{8,11}$/.test(target)) return json({ error: 'Nomor WhatsApp peserta bukan nomor HP yang valid (harus berawalan 628). Perbaiki di menu Peserta.' }, 400)
  const pesan = (adaGambar) => untukWA(isiPesan({ pf, sf, maps, base, ticketId, adaGambar }).teks)
  // Bila peserta punya email valid, WhatsApp hanya mengarahkan ke email (tiketnya ada di email). Tanpa email valid, WhatsApp tetap membawa tiket penuh (QR + tautan) supaya peserta tidak tanpa tiket.
  // tiketPenuh = admin sengaja mengirim tiket lengkap (QR + tautan) lewat WhatsApp, misalnya untuk peserta yang emailnya bermasalah.
  const arahEmail = !tiketPenuh && EMAIL_VALID.test((pf.email?.stringValue || '').trim())

  // Coba gambar QR dulu (paket Fonnte Super ke atas); jika ditolak kirim teks + tautan saja.
  // WA_KIRIM_GAMBAR=false di Netlify = selalu teks + tautan.
  const kirim = async (message, extra) => { const r = await fetch('https://api.fonnte.com/send', { method: 'POST', headers: { Authorization: FT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, message, countryCode: '62', ...extra }) }); const d = await r.json().catch(() => ({})); return { ok: r.ok && d.status !== false, reason: d.reason } }
  const GAMBAR = (process.env.WA_KIRIM_GAMBAR || 'true').toLowerCase() !== 'false'
  let via = 'fonnte', note = '', res = { ok: false }
  if (arahEmail) { via = 'fonnte-arahan-email'; res = await kirim(untukWA(isiPesanArahEmail({ pf, sf }).teks), {}); if (!res.ok) return json({ error: `Fonnte: ${res.reason || 'gagal mengirim'}` }, 502) }
  else if (GAMBAR) { via = 'fonnte-gambar'; res = await kirim(pesan(true), { url: `${base}/qr/${ticketId}.png` }) }
  if (!arahEmail && !res.ok) { if (GAMBAR) note = res.reason || 'gambar ditolak'; via = 'fonnte'; res = await kirim(pesan(false), {}) }
  if (!res.ok) return json({ error: `Fonnte: ${res.reason || 'gagal mengirim'}` }, 502)

  const tersimpan = await tandaiTiket(idToken, ticketId, { sentAt: { timestampValue: new Date().toISOString() }, sentVia: { stringValue: via } })
  return json({ ok: true, via, note, ...(tersimpan ? {} : { warn: PERINGATAN_STATUS }) })
}
