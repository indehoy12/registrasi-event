// Gambar peta statis (PNG) untuk email: ubin OpenStreetMap digabung di server, lalu diberi pin merah di titik lokasi.
// Email tidak bisa memuat peta interaktif (iframe diblokir), jadi peta dikirim sebagai gambar yang bisa diklik ke Google Maps.
// Bila ubin gagal diunduh, fungsi mengembalikan null dan email tetap terkirim tanpa gambar peta (tautan Maps tetap ada di teks).
import { PNG } from 'pngjs'

const Z = 16, T = 256, W = 640, H = 320
const UA = 'RegistrasiSeminar/1.0 (peta lokasi untuk email tiket peserta)'
const cache = new Map()   // instance function yang masih "hangat" memakai ulang gambar yang sama untuk semua email

// Koordinat dari data seminar (lat/lng) atau dari tautan Google Maps panjang
export function koordinat(sf) {
  const lat = sf.lat?.doubleValue ?? (sf.lat?.integerValue != null ? +sf.lat.integerValue : null), lng = sf.lng?.doubleValue ?? (sf.lng?.integerValue != null ? +sf.lng.integerValue : null)
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
  const u = sf.mapsUrl?.stringValue || '', m = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || u.match(/[?&](?:q|query|ll)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i)
  return m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180 ? { lat: +m[1], lng: +m[2] } : null
}

// Titik (piksel global pada zoom Z) untuk sebuah koordinat
const global = (lat, lng) => { const n = 2 ** Z, r = lat * Math.PI / 180
  return { x: (lng + 180) / 360 * n * T, y: (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n * T } }

async function ubin(x, y) {
  const r = await fetch(`https://tile.openstreetmap.org/${Z}/${x}/${y}.png`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) })
  if (!r.ok) throw new Error('ubin ' + r.status)
  return PNG.sync.read(Buffer.from(await r.arrayBuffer()))
}

// Pin merah dengan titik putih; ujung pin tepat di (cx, cy). Tepi dihaluskan dengan 3x3 sub-piksel.
function gambarPin(png, cx, cy) {
  const R = 14, py = cy - 30   // pusat lingkaran
  const dalamSegitiga = (x, y) => { const ax = cx - 11, ay = py + 8, bx = cx + 11, by = py + 8, tx = cx, ty = cy
    const s = (x1, y1, x2, y2) => (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2), d1 = s(ax, ay, bx, by), d2 = s(bx, by, tx, ty), d3 = s(tx, ty, ax, ay)
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)) }
  const warna = (x, y) => { const dx = x - cx, dy = y - py, d = Math.hypot(dx, dy)
    if (d <= 5) return [255, 255, 255]; if (d <= R - 2) return [217, 48, 37]; if (d <= R) return [140, 20, 14]
    if (dalamSegitiga(x, y)) return [217, 48, 37]; return null }
  // bayangan lembut di bawah ujung pin
  for (let y = cy - R - 40; y <= cy + 6; y++) for (let x = cx - R - 4; x <= cx + R + 4; x++) {
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue
    let a = 0, rr = 0, g = 0, b = 0
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) { const c = warna(x + (sx + .5) / 3 - .5, y + (sy + .5) / 3 - .5); if (c) { a++; rr += c[0]; g += c[1]; b += c[2] } }
    if (!a) continue
    const i = (png.width * y + x) << 2, p = a / 9
    png.data[i] = Math.round(png.data[i] * (1 - p) + rr / a * p); png.data[i + 1] = Math.round(png.data[i + 1] * (1 - p) + g / a * p); png.data[i + 2] = Math.round(png.data[i + 2] * (1 - p) + b / a * p); png.data[i + 3] = 255
  }
}

export async function petaPng(lat, lng) {
  const kunci = `${lat.toFixed(6)},${lng.toFixed(6)}`; if (cache.has(kunci)) return cache.get(kunci)
  try {
    const g = global(lat, lng), kiri = Math.round(g.x - W / 2), atas = Math.round(g.y - H / 2)
    const x0 = Math.floor(kiri / T), x1 = Math.floor((kiri + W - 1) / T), y0 = Math.floor(atas / T), y1 = Math.floor((atas + H - 1) / T)
    const daftar = []; for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) daftar.push([tx, ty])
    const hasil = await Promise.all(daftar.map(([tx, ty]) => ubin(tx, ty)))
    const out = new PNG({ width: W, height: H })
    daftar.forEach(([tx, ty], k) => { const t = hasil[k], ox = tx * T - kiri, oy = ty * T - atas
      for (let y = 0; y < T; y++) { const dy = oy + y; if (dy < 0 || dy >= H) continue
        for (let x = 0; x < T; x++) { const dx = ox + x; if (dx < 0 || dx >= W) continue
          const s = (T * y + x) << 2, d = (W * dy + dx) << 2; out.data[d] = t.data[s]; out.data[d + 1] = t.data[s + 1]; out.data[d + 2] = t.data[s + 2]; out.data[d + 3] = 255 } } })
    gambarPin(out, Math.round(g.x - kiri), Math.round(g.y - atas))
    const buf = PNG.sync.write(out); cache.set(kunci, buf); return buf
  } catch (e) { console.error('peta gagal dibuat:', e.message); return null }
}
