// Gambar QR publik: /qr/<kode-tiket>.png  (dipakai Fonnte sebagai lampiran gambar)
import QRCode from 'qrcode'

export default async (req, context) => {
  const token = String(context.params?.file || '').replace(/\.png$/i, '')
  if (!/^[\w-]{16,80}$/.test(token)) return new Response('Not found', { status: 404 })
  const png = await QRCode.toBuffer(token, { width: 700, margin: 2 })
  return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' } })
}

export const config = { path: '/qr/:file' }
