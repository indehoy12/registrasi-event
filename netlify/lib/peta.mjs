// Gambar peta lokasi (PNG) dengan penanda, dirakit dari ubin OpenStreetMap di server.
// Dipakai di email (lampiran gambar inline) dan di halaman tiket (/peta/<lat>,<lng>.png).
// Catatan lisensi: data peta (c) kontributor OpenStreetMap; tampilkan atribusi di dekat gambar.
import { PNG } from 'pngjs'

const LEBAR = 600, TINGGI = 300, ZOOM = 16, UBIN = 256
const cache = new Map()   // koordinat -> Promise<Buffer>; dipakai ulang selama fungsi masih "hangat"

// Membaca koordinat dari tautan Google Maps (format panjang). Tautan pendek (maps.app.goo.gl) tidak berisi koordinat -> null.
export function koordinatDariMaps(v = '') {
  const s = String(v), m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i)
  return m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180 ? { lat: +m[1], lng: +m[2] } : null
}

async function ambilUbin(z, x, y, fetchImpl) {
  const r = await fetchImpl(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, { headers: { 'User-Agent': 'seminar-tiket/1.0 (peta lokasi pada email dan tiket peserta)' }, signal: AbortSignal.timeout(7000) })
  if (!r.ok) throw new Error(`Ubin peta ditolak (${r.status})`)
  return PNG.sync.read(Buffer.from(await r.arrayBuffer()))
}

// Menyalin sebagian ubin ke kanvas dengan pemotongan di tepi.
function tempel(src, dst, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    const ty = dy + y; if (ty < 0 || ty >= dst.height) continue
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x; if (tx < 0 || tx >= dst.width) continue
      const s = (y * src.width + x) << 2, d = (ty * dst.width + tx) << 2
      dst.data[d] = src.data[s]; dst.data[d + 1] = src.data[s + 1]; dst.data[d + 2] = src.data[s + 2]; dst.data[d + 3] = 255
    }
  }
}
function lingkaran(dst, cx, cy, r, [R, G, B]) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    if (x < 0 || y < 0 || x >= dst.width || y >= dst.height) continue
    const jarak = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (jarak > r) continue
    const d = (y * dst.width + x) << 2; dst.data[d] = R; dst.data[d + 1] = G; dst.data[d + 2] = B; dst.data[d + 3] = 255
  }
}

async function rakit(lat, lng, fetchImpl) {
  const n = 2 ** ZOOM, sin = Math.sin(lat * Math.PI / 180)
  const px = (lng + 180) / 360 * n * UBIN, py = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n * UBIN
  const x0 = px - LEBAR / 2, y0 = py - TINGGI / 2
  const tx0 = Math.floor(x0 / UBIN), tx1 = Math.floor((x0 + LEBAR - 1) / UBIN), ty0 = Math.floor(y0 / UBIN), ty1 = Math.floor((y0 + TINGGI - 1) / UBIN)
  const kanvas = new PNG({ width: LEBAR, height: TINGGI }); kanvas.data.fill(235)
  const kerja = []
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) kerja.push(ambilUbin(ZOOM, ((tx % n) + n) % n, ty, fetchImpl).then(u => tempel(u, kanvas, Math.round(tx * UBIN - x0), Math.round(ty * UBIN - y0))))
  await Promise.all(kerja)
  // Penanda lokasi: titik merah berbingkai putih tepat di koordinat.
  lingkaran(kanvas, LEBAR / 2, TINGGI / 2, 15, [255, 255, 255]); lingkaran(kanvas, LEBAR / 2, TINGGI / 2, 11, [225, 29, 72]); lingkaran(kanvas, LEBAR / 2, TINGGI / 2, 4, [255, 255, 255])
  return PNG.sync.write(kanvas)
}

// Mengembalikan Buffer PNG peta untuk koordinat tersebut. Gagal -> melempar error (pemanggil sebaiknya melanjutkan tanpa peta).
export function petaPng(lat, lng, fetchImpl = fetch) {
  const kunci = `${(+lat).toFixed(5)},${(+lng).toFixed(5)}`
  if (!cache.has(kunci)) cache.set(kunci, rakit(+lat, +lng, fetchImpl).catch(e => { cache.delete(kunci); throw e }))
  return cache.get(kunci)
}
