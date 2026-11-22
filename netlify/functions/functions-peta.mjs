// Gambar peta publik: /peta/<lat>,<lng>.png  (dipakai halaman tiket peserta)
import { petaPng } from '../lib/peta.mjs'

export default async (req, context) => {
  const nama = decodeURIComponent(String(context.params?.file || new URL(req.url).pathname.split('/').pop() || '')).replace(/\.png$/i, '')
  const m = nama.match(/^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/)
  if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) return new Response('Not found', { status: 404 })
  try {
    const png = await petaPng(+m[1], +m[2])
    return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800, immutable' } })
  } catch (e) {
    console.error('peta gagal:', e.message)
    return new Response('Peta tidak tersedia', { status: 502 })
  }
}

export const config = { path: '/peta/:file' }
