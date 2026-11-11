// Pembuat file Excel: laporan kehadiran (3 lembar) dan daftar hadir cadangan (siap cetak).
// ExcelJS baru dimuat saat tombol unduh ditekan, jadi tidak membebani halaman lain.
// Fungsi buat* murni (tidak menyentuh browser) agar mudah diuji; fungsi unduh* yang menyimpan file.
const FONT = 'Arial'
// Tampilan polos: latar putih semua, tanpa blok warna. Pembeda hanya tebal/miring, garis, dan abu-abu pada teks. Aman untuk printer hitam-putih.
const C = { ink: 'FF111111', muted: 'FF595959', garis: 'FFBFBFBF' }
const tipis = { style: 'thin', color: { argb: C.garis } }, kotak = { top: tipis, left: tipis, bottom: tipis, right: tipis }
const tebal = { style: 'medium', color: { argb: C.ink } }, hitamTipis = { style: 'thin', color: { argb: C.ink } }
const kol = (n) => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s }
// Excel menyimpan jam tanpa zona waktu; geser agar jam yang tampil sama dengan jam lokal petugas (WIB/WITA/WIT)
const lokal = (t) => { const d = t?.toDate ? t.toDate() : null; return d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000) : null }
const FMT_WAKTU = 'dd/mm/yyyy hh:mm'

function gaya(c, o = {}) {
  c.font = { name: FONT, size: o.size || 10, bold: !!o.bold, italic: !!o.italic, color: { argb: o.color || C.ink } }
  c.alignment = { horizontal: o.h || 'left', vertical: o.v || 'middle', wrapText: o.wrap !== false }
  if (o.border) c.border = o.border
  if (o.fmt) c.numFmt = o.fmt
}
// Header: huruf tebal, garis tebal di atas dan bawah. Header dua tingkat: 'atas' (garis tebal atas, tipis bawah) dan 'bawah' (garis tebal bawah).
const header = (c, tipe) => gaya(c, { bold: true, h: 'center', border: tipe === 'atas' ? { top: tebal, bottom: hitamTipis } : tipe === 'bawah' ? { bottom: tebal } : { top: tebal, bottom: tebal } })
const nama = (s) => String(s || 'seminar').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'seminar'
const hariIni = () => new Date().toLocaleDateString('sv-SE')
const dibuat = () => new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })

function aturCetak(ws, { landscape, judulBaris, footer }) {
  ws.pageSetup = { paperSize: 9, orientation: landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: .4, right: .4, top: .6, bottom: .6, header: .3, footer: .3 }, ...(judulBaris ? { printTitlesRow: judulBaris } : {}) }
  ws.headerFooter = { oddFooter: `&L${footer}&RHalaman &P dari &N` }
}
// Baris judul di atas tabel: judul besar, nama acara, tanggal/tempat. Mengembalikan nomor baris berikutnya yang kosong.
function blokJudul(ws, judul, { sem, tanggal }, tambahan = []) {
  const baris = [[judul, { bold: true, size: 15, color: C.ink }], [sem.title || 'Seminar', { bold: true, size: 12 }],
    ...[tanggal && `Tanggal: ${tanggal}`, sem.time && `Waktu: pukul ${String(sem.time).replace(':', '.')}`, sem.location && `Tempat: ${sem.location}`].filter(Boolean).map(t => [t, { color: C.muted }]),
    ...tambahan.map(t => [t, { color: C.muted, italic: true }])]
  baris.forEach(([t, o], i) => { const c = ws.getCell(i + 1, 1); c.value = t; gaya(c, { ...o, wrap: false }); ws.getRow(i + 1).height = o.size ? o.size + 8 : 16 })
  return baris.length + 2
}

// ---------------------------------------------------------------------------------------------------------------------
// Laporan kehadiran: lembar Ringkasan (rumus), Kehadiran (per peserta), Riwayat check-in (kronologis)
export function buatLaporan(ExcelJS, { sem = {}, days, ps, cs, ts, hariLabel, ckDay, showCode, tgl }) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Registrasi Seminar'; wb.created = new Date()
  const multi = days.length > 1, tanggal = days.filter(d => /^\d{4}-/.test(d)).map(tgl).join(' dan ')
  const rs = wb.addWorksheet('Ringkasan', { views: [{ showGridLines: false }] }), ws = wb.addWorksheet('Kehadiran', { views: [{ showGridLines: false }] })
  const rw = wb.addWorksheet('Riwayat check-in', { views: [{ showGridLines: false }] })

  // ----- data -----
  const kode = Object.fromEntries(ts.filter(t => t.status !== 'dicabut').map(t => [t.participantId, showCode(t.id)]))
  const idPs = new Set(ps.map(p => p.id)), urut = (a, b) => (a.nama || '').localeCompare(b.nama || '', 'id')
  const cekin = new Map(); cs.forEach(c => { const k = c.participantId + '|' + ckDay(c, days); if (!cekin.has(k)) cekin.set(k, c) })
  const dihapus = [...new Map(cs.filter(c => !idPs.has(c.participantId)).map(c => [c.participantId,
    { id: c.participantId, nama: c.participantName || '', inst: '(peserta sudah dihapus)', kode: c.ticketId ? showCode(c.ticketId) : '-' }])).values()].sort(urut)
  const orang = [...ps.map(p => ({ id: p.id, nama: p.name || '', inst: p.institution || '(tanpa instansi)', kode: kode[p.id] || '-' })).sort(urut), ...dihapus]
  const n = orang.length

  // ----- lembar Kehadiran -----
  const base = 4, per = 4, totalKol = base + per * days.length + 1, nKol = multi ? totalKol : base + per * days.length
  const mulai = blokJudul(ws, 'Laporan Kehadiran', { sem, tanggal })
  const hdr = mulai + (multi ? 1 : 0), awal = hdr + 1, akhir = hdr + n
  const kS = (i) => base + 1 + per * i        // kolom status untuk hari ke-i (disusul Hadir sebagai, Nama perwakilan, Waktu)
  const lebar = [6, 30, 34, 12]; days.forEach(() => lebar.push(13, 14, 24, 17)); if (multi) lebar.push(12)
  lebar.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  const dasar = ['No', 'Nama', 'Instansi', 'No. tiket'], sub = ['Status', 'Hadir sebagai', 'Nama perwakilan', 'Waktu check-in']
    if (multi) {
    for (let c = 1; c <= nKol; c++) header(ws.getCell(hdr - 1, c), 'atas')
    days.forEach((d, i) => { for (let c = kS(i); c < kS(i) + 4; c++) header(ws.getCell(hdr - 1, c), 'atas')
      ws.mergeCells(hdr - 1, kS(i), hdr - 1, kS(i) + 3); ws.getCell(hdr - 1, kS(i)).value = hariLabel(days, d) })
    ws.getCell(hdr - 1, totalKol).value = 'Rekap'; ws.getRow(hdr - 1).height = 20
  }
  for (let c = 1; c <= nKol; c++) { const cell = ws.getCell(hdr, c)
    cell.value = c <= base ? dasar[c - 1] : c === totalKol && multi ? 'Jumlah hari hadir' : sub[(c - base - 1) % per]; header(cell, multi ? 'bawah' : 'tunggal') }
  ws.getRow(hdr).height = 32
  orang.forEach((o, r) => { const row = r + awal, vals = [r + 1, o.nama, o.inst, o.kode]
    days.forEach(d => { const c = cekin.get(o.id + '|' + d); vals.push(c ? 'Hadir' : 'Belum hadir', c ? (c.isRepresentative ? 'Perwakilan' : 'Peserta') : '', c?.representativeName || '', lokal(c?.checkedInAt)) })
    vals.forEach((v, i) => { const cell = ws.getCell(row, i + 1), tengah = i === 0 || i === 3 || (i >= base && (i - base) % per !== 2)
      cell.value = v; gaya(cell, { h: tengah ? 'center' : 'left', border: kotak, fmt: i >= base && (i - base) % per === 3 ? FMT_WAKTU : undefined }) })
    if (multi) { const cell = ws.getCell(row, totalKol), rumus = days.map((_, i) => `(${kol(kS(i))}${row}="Hadir")`).join('+')
      cell.value = { formula: rumus, result: days.filter(d => cekin.has(o.id + '|' + d)).length }; gaya(cell, { h: 'center', bold: true, border: kotak }) }
    ws.getRow(row).height = 18 })
  if (n) {
    days.forEach((_, i) => {
      ws.addConditionalFormatting({ ref: `${kol(kS(i))}${awal}:${kol(kS(i))}${akhir}`, rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['"Hadir"'], priority: 1, style: { font: { bold: true } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"Belum hadir"'], priority: 2, style: { font: { italic: true, color: { argb: C.muted } } } }] })
      ws.addConditionalFormatting({ ref: `${kol(kS(i) + 1)}${awal}:${kol(kS(i) + 1)}${akhir}`, rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['"Perwakilan"'], priority: 3, style: { font: { bold: true } } }] })
    })
    ws.autoFilter = `A${hdr}:${kol(nKol)}${akhir}`
  }
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: hdr, topLeftCell: `C${awal}`, showGridLines: false }]
  aturCetak(ws, { landscape: true, judulBaris: multi ? `${hdr - 1}:${hdr}` : `${hdr}:${hdr}`, footer: 'Laporan Kehadiran' })

  // ----- lembar Ringkasan (angka dihitung dengan rumus dari lembar Kehadiran) -----
  const a = awal, z = Math.max(awal, akhir), R = (k) => `Kehadiran!$${kol(k)}$${a}:$${kol(k)}$${z}`
  let r = blokJudul(rs, 'Laporan Kehadiran', { sem, tanggal }, [`Dibuat ${dibuat()}`])
  ;[34, 30, 16, 14, 18, 14, 18].forEach((w, i) => { rs.getColumn(i + 1).width = w })
  const judulTabel = (t) => { const c = rs.getCell(r, 1); c.value = t; gaya(c, { bold: true, size: 12, color: C.ink, wrap: false }); rs.getRow(r).height = 22; r++ }
  const kepala = (labels) => { labels.forEach((t, i) => { const c = rs.getCell(r, i + 1); c.value = t; header(c) }); rs.getRow(r).height = 32; r++ }
  const sel = (rr, cc, v, o = {}) => { const c = rs.getCell(rr, cc); c.value = v; gaya(c, { border: kotak, ...o }); return c }
  const stat = days.map(d => { let h = 0, w = 0; orang.forEach(o => { const c = cekin.get(o.id + '|' + d); if (c) { h++; if (c.isRepresentative) w++ } }); return { h, w } })
  judulTabel('Rekap kehadiran per hari'); kepala(['Hari', 'Tanggal', 'Total peserta', 'Hadir', 'Lewat perwakilan', 'Belum hadir', 'Tingkat kehadiran'])
  days.forEach((d, i) => { sel(r, 1, multi ? `Hari ${i + 1}` : 'Hari kegiatan', { bold: true }); sel(r, 2, /^\d{4}-/.test(d) ? tgl(d) : '-')
    sel(r, 3, { formula: `COUNTA(${R(2)})`, result: n }, { h: 'center' })
    sel(r, 4, { formula: `COUNTIF(${R(kS(i))},"Hadir")`, result: stat[i].h }, { h: 'center', bold: true })
    sel(r, 5, { formula: `COUNTIF(${R(kS(i) + 1)},"Perwakilan")`, result: stat[i].w }, { h: 'center' })
    sel(r, 6, { formula: `C${r}-D${r}`, result: n - stat[i].h }, { h: 'center', color: C.muted })
    sel(r, 7, { formula: `IF(C${r}=0,0,D${r}/C${r})`, result: n ? stat[i].h / n : 0 }, { h: 'center', bold: true, fmt: '0.0%' }); rs.getRow(r).height = 20; r++ })
  if (multi) { sel(r, 1, 'Peserta yang hadir di semua hari', { bold: true }); for (let c = 2; c <= 3; c++) sel(r, c, null); rs.mergeCells(r, 1, r, 3)
    sel(r, 4, { formula: `COUNTIF(${R(totalKol)},${days.length})`, result: orang.filter(o => days.every(d => cekin.has(o.id + '|' + d))).length }, { h: 'center', bold: true }); rs.getRow(r).height = 20; r++ }
  r++; judulTabel('Rekap per instansi'); kepala(['Instansi', 'Peserta', multi ? 'Hadir (minimal 1 hari)' : 'Hadir', 'Belum hadir', 'Tingkat kehadiran'])
  const grup = new Map(); orang.forEach(o => { const g = grup.get(o.inst) || { p: 0, h: 0 }; g.p++; if (days.some(d => cekin.has(o.id + '|' + d))) g.h++; grup.set(o.inst, g) })
  const daftar = [...grup].sort((x, y) => y[1].p - x[1].p || x[0].localeCompare(y[0], 'id')), r0 = r
  daftar.forEach(([inst, g]) => { sel(r, 1, inst, { bold: true })
    sel(r, 2, { formula: `SUMPRODUCT(--(${R(3)}=A${r}))`, result: g.p }, { h: 'center' })
    sel(r, 3, { formula: multi ? `SUMPRODUCT((${R(3)}=A${r})*(${R(totalKol)}>0))` : `SUMPRODUCT((${R(3)}=A${r})*(${R(kS(0))}="Hadir"))`, result: g.h }, { h: 'center', bold: true })
    sel(r, 4, { formula: `B${r}-C${r}`, result: g.p - g.h }, { h: 'center', color: C.muted })
    sel(r, 5, { formula: `IF(B${r}=0,0,C${r}/B${r})`, result: g.p ? g.h / g.p : 0 }, { h: 'center', fmt: '0.0%' }); rs.getRow(r).height = 20; r++ })
  if (daftar.length) { const tp = daftar.reduce((s, x) => s + x[1].p, 0), th = daftar.reduce((s, x) => s + x[1].h, 0), t = { bold: true, h: 'center' }
    sel(r, 1, 'Jumlah', { bold: true }); sel(r, 2, { formula: `SUM(B${r0}:B${r - 1})`, result: tp }, t); sel(r, 3, { formula: `SUM(C${r0}:C${r - 1})`, result: th }, t)
    sel(r, 4, { formula: `B${r}-C${r}`, result: tp - th }, t); sel(r, 5, { formula: `IF(B${r}=0,0,C${r}/B${r})`, result: tp ? th / tp : 0 }, { ...t, fmt: '0.0%' }); rs.getRow(r).height = 20; r++ }
  r++; const catatan = ['Catatan:', 'Angka di lembar ini dihitung otomatis dari lembar Kehadiran, jadi ikut berubah bila data di sana diedit.',
    'Lewat perwakilan: peserta hadir diwakili orang lain; nama perwakilan tercatat di lembar Kehadiran.',
    ...(multi ? ['Satu tiket berlaku untuk semua hari; kehadiran dicatat per hari.'] : []),
    ...(dihapus.length ? ['Baris "(peserta sudah dihapus)" adalah peserta yang sempat check-in lalu dihapus dari daftar; tetap dihitung agar laporan sesuai kenyataan.'] : [])]
  catatan.forEach((t, i) => { const c = rs.getCell(r + i, 1); c.value = t; gaya(c, { color: C.muted, bold: i === 0, size: 9, wrap: false }) })
  aturCetak(rs, { landscape: false, footer: 'Laporan Kehadiran' })

  // ----- lembar Riwayat check-in -----
  const urutan = [...cs].sort((x, y) => (x.checkedInAt?.toMillis?.() ?? 0) - (y.checkedInAt?.toMillis?.() ?? 0))
  const kolR = [['No', 6], ['Waktu', 18], ...(multi ? [['Hari', 16]] : []), ['Nama peserta', 30], ['No. tiket', 12], ['Hadir sebagai', 14], ['Nama perwakilan', 24], ['Cara', 10], ['Petugas', 30]]
  const hr = blokJudul(rw, 'Riwayat Check-in', { sem, tanggal }, ['Urut dari yang paling awal.'])
  kolR.forEach(([t, w], i) => { rw.getColumn(i + 1).width = w; const c = rw.getCell(hr, i + 1); c.value = t; header(c) }); rw.getRow(hr).height = 28
  urutan.forEach((c, i) => { const row = hr + 1 + i, v = [i + 1, lokal(c.checkedInAt), ...(multi ? [hariLabel(days, ckDay(c, days))] : []), c.participantName || '', c.ticketId ? showCode(c.ticketId) : '',
      c.isRepresentative ? 'Perwakilan' : 'Peserta', c.representativeName || '', c.via === 'manual' ? 'Manual' : 'QR', c.officerEmail || '']
    v.forEach((x, j) => { const cell = rw.getCell(row, j + 1), kolom = kolR[j][0]; cell.value = x
      gaya(cell, { border: kotak, h: ['No', 'Waktu', 'Hari', 'No. tiket', 'Hadir sebagai', 'Cara'].includes(kolom) ? 'center' : 'left', fmt: kolom === 'Waktu' ? FMT_WAKTU : undefined, ...(kolom === 'Hadir sebagai' && x === 'Perwakilan' ? { bold: true } : {}) }) })
    rw.getRow(row).height = 18 })
  if (urutan.length) rw.autoFilter = `A${hr}:${kol(kolR.length)}${hr + urutan.length}`
  rw.views = [{ state: 'frozen', ySplit: hr, showGridLines: false }]
  aturCetak(rw, { landscape: true, judulBaris: `${hr}:${hr}`, footer: 'Riwayat Check-in' })
  return wb
}

// ---------------------------------------------------------------------------------------------------------------------
// Daftar hadir cadangan: nama, instansi, nomor tiket, dan kolom paraf yang lega untuk ditulis tangan
export function buatCadangan(ExcelJS, { sem = {}, days, ps, ts, hariLabel, showCode, tgl }) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Registrasi Seminar'; wb.created = new Date()
  const ws = wb.addWorksheet('Daftar hadir', { views: [{ showGridLines: false }] }), multi = days.length > 1
  const tanggal = days.filter(d => /^\d{4}-/.test(d)).map(tgl).join(' dan ')
  const kode = Object.fromEntries(ts.filter(t => t.status !== 'dicabut').map(t => [t.participantId, showCode(t.id)]))
  const list = [...ps].sort((x, y) => (x.name || '').localeCompare(y.name || '', 'id'))
  const hdr = blokJudul(ws, 'Daftar Hadir', { sem, tanggal }, ['Cadangan bila internet bermasalah. Cocokkan nomor tiket dengan tiket peserta, lalu minta paraf. Perwakilan: tulis namanya di kolom keterangan.'])
  const kolom = [['No', 6], ['Nama', 30], ['Instansi', 34], ['No. tiket', 12], ...days.map((d) => [multi ? `Paraf\n${hariLabel(days, d)}` : 'Paraf', 22]), ['Keterangan / nama perwakilan', 30]]
  kolom.forEach(([t, w], i) => { ws.getColumn(i + 1).width = w; const c = ws.getCell(hdr, i + 1); c.value = t; header(c) }); ws.getRow(hdr).height = 34
  list.forEach((p, r) => { const row = hdr + 1 + r, v = [r + 1, p.name || '', p.institution || '', kode[p.id] || '(belum ada tiket)', ...days.map(() => ''), '']
    v.forEach((x, i) => { const c = ws.getCell(row, i + 1); c.value = x; gaya(c, { border: kotak, h: i === 0 || i === 3 ? 'center' : 'left' }) }); ws.getRow(row).height = 26 })
  ws.views = [{ state: 'frozen', ySplit: hdr, showGridLines: false }]
  aturCetak(ws, { landscape: multi || days.length > 2, judulBaris: `${hdr}:${hdr}`, footer: 'Daftar Hadir' })
  return wb
}

// ---------------------------------------------------------------------------------------------------------------------
async function simpan(wb, berkas) {
  const buf = await wb.xlsx.writeBuffer(), url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = berkas; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000)
}
const muat = async () => (await import('exceljs')).default
export async function unduhLaporan(d) { const wb = buatLaporan(await muat(), d); await simpan(wb, `laporan-kehadiran-${nama(d.sem?.title)}-${hariIni()}.xlsx`) }
export async function unduhCadangan(d) { const wb = buatCadangan(await muat(), d); await simpan(wb, `daftar-hadir-cadangan-${nama(d.sem?.title)}.xlsx`) }
