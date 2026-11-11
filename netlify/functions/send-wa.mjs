// Mengirim tiket lewat WhatsApp (Fonnte). Token Fonnte hanya ada di server (environment variable Netlify).
import { json, siapkan, tandaiTiket, isiPesan, untukWA, PERINGATAN_STATUS } from '../lib/common.mjs'
const FT = process.env.FONNTE_TOKEN

export default async (req) => {
  const { err, data } = await siapkan(req, ['FONNTE_TOKEN']); if (err) return err
  const { idToken, ticketId, pf, sf, maps, base } = data
  const wa = (pf.whatsapp?.stringValue || '').replace(/\D/g, '')
  if (!wa) return json({ error: 'Nomor WhatsApp peserta kosong.' }, 400)
  const target = wa.startsWith('0') ? '62' + wa.slice(1) : wa
  const pesan = (adaGambar) => untukWA(isiPesan({ pf, sf, maps, base, ticketId, adaGambar }).teks)

  // Coba gambar QR dulu (paket Fonnte Super ke atas); jika ditolak kirim teks + tautan saja.
  // WA_KIRIM_GAMBAR=false di Netlify = selalu teks + tautan.
  const kirim = async (message, extra) => { const r = await fetch('https://api.fonnte.com/send', { method: 'POST', headers: { Authorization: FT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, message, countryCode: '62', ...extra }) }); const d = await r.json().catch(() => ({})); return { ok: r.ok && d.status !== false, reason: d.reason } }
  const GAMBAR = (process.env.WA_KIRIM_GAMBAR || 'true').toLowerCase() !== 'false'
  let via = 'fonnte', note = '', res = { ok: false }
  if (GAMBAR) { via = 'fonnte-gambar'; res = await kirim(pesan(true), { url: `${base}/qr/${ticketId}.png` }) }
  if (!res.ok) { if (GAMBAR) note = res.reason || 'gambar ditolak'; via = 'fonnte'; res = await kirim(pesan(false), {}) }
  if (!res.ok) return json({ error: `Fonnte: ${res.reason || 'gagal mengirim'}` }, 502)

  const tersimpan = await tandaiTiket(idToken, ticketId, { sentAt: { timestampValue: new Date().toISOString() }, sentVia: { stringValue: via } })
  return json({ ok: true, via, note, ...(tersimpan ? {} : { warn: PERINGATAN_STATUS }) })
}
