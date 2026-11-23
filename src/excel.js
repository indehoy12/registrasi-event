// Pembuat file Excel: laporan kehadiran (Ringkasan, Kehadiran, satu lembar per hari, Riwayat), laporan satu hari dan daftar hadir cadangan (siap cetak).
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
// Tinggi baris menyesuaikan teks panjang yang membungkus (Excel tidak mengaturnya sendiri untuk file buatan program): kira-kira satu baris per (lebar kolom - 2) karakter
const tinggiBaris = (vals, lebar, min = 18) => { let m = 1; vals.forEach((v, i) => { if (typeof v === 'string' && lebar[i]) m = Math.max(m, Math.ceil(v.length / Math.max(lebar[i] - 2, 4))) }); return Math.max(min, m * 13 + 5) }

function aturCetak(ws, { landscape, judulBaris, footer }) {
  ws.pageSetup = { paperSize: 9, orientation: landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: .4, right: .4, top: .6, bottom: .6, header: .3, footer: .3 }, ...(judulBaris ? { printTitlesRow: judulBaris } : {}) }
  ws.headerFooter = { oddFooter: `&L${footer}&RHalaman &P dari &N` }
}
// Baris judul di atas tabel, dibuat ringkas: judul, nama acara, "tanggal · waktu · tempat" dalam satu baris, lalu catatan (satu baris per item). Satu baris info = tidak memakan banyak ruang
// saat baris judul tabel dibekukan. Mengembalikan nomor baris berikutnya yang kosong (satu baris kosong dilewati sebagai jarak).
function blokJudul(ws, judul, { sem, tanggal }, tambahan = []) {
  const info = [tanggal && `Tanggal: ${tanggal}`, sem.time && `Waktu: pukul ${String(sem.time).replace(':', '.')} WIB`, sem.location && `Tempat: ${sem.location}`].filter(Boolean).join('   ·   ')
  const baris = [[judul, { bold: true, size: 15, color: C.ink }], [sem.title || 'Seminar', { bold: true, size: 12 }],
    ...(info ? [[info, { color: C.muted }]] : []), ...tambahan.map(t => [t, { color: C.muted, italic: true }])]
  baris.forEach(([t, o], i) => { const c = ws.getCell(i + 1, 1); c.value = t; gaya(c, { ...o, wrap: false }); ws.getRow(i + 1).height = o.size ? o.size + 8 : 16 })
  return baris.length + 2
}

// ---------------------------------------------------------------------------------------------------------------------
// Bahan bersama: daftar orang (peserta + yang sudah dihapus tapi pernah check-in) dan peta check-in per orang per hari
function siapkan({ days, ps, cs, ts, ckDay, showCode, tgl, hariBoleh = () => true }) {
  const multi = days.length > 1, tanggal = days.filter(d => /^\d{4}-/.test(d)).map(tgl).join(' dan ')
  const kode = Object.fromEntries(ts.filter(t => t.status !== 'dicabut').map(t => [t.participantId, showCode(t.id)]))
  const idPs = new Set(ps.map(p => p.id)), urut = (a, b) => (a.nama || '').localeCompare(b.nama || '', 'id')
  const cekin = new Map(); cs.forEach(c => { const k = c.participantId + '|' + ckDay(c, days); if (!cekin.has(k)) cekin.set(k, c) })
  const dihapus = [...new Map(cs.filter(c => !idPs.has(c.participantId)).map(c => [c.participantId,
    { id: c.participantId, nama: c.participantName || '', inst: '(peserta sudah dihapus)', kode: c.ticketId ? showCode(c.ticketId) : '-', boleh: (d) => cekin.has(c.participantId + '|' + d) }])).values()].sort(urut)
  const orang = [...ps.map(p => ({ id: p.id, nama: p.name || '', inst: p.institution || '(tanpa perusahaan)', kode: kode[p.id] || '-', boleh: (d) => hariBoleh(p, d, days) })).sort(urut), ...dihapus]
  return { multi, tanggal, orang, cekin, dihapus, n: orang.length }
}

// Satu lembar untuk SATU hari: hanya peserta yang dijadwalkan (atau sudah check-in) pada hari itu. Angka rekap di atas tabel dihitung dengan rumus.
function lembarHari(wb, { sem, days, tgl, hariLabel, orang, cekin, tanggalHari }, d, i) {
  const label = hariLabel(days, d), ws = wb.addWorksheet(label.slice(0, 31), { views: [{ showGridLines: false }] })
  const list = orang.filter(o => cekin.has(o.id + '|' + d) || o.boleh(d))
  const m = blokJudul(ws, days.length > 1 ? `Laporan Kehadiran Hari ke-${i + 1}` : 'Laporan Kehadiran', { sem, tanggal: /^\d{4}-/.test(d) ? tgl(d) : '' }, [`Dibuat ${dibuat()}`])
  const hdr = m + 1, awal = hdr + 1, akhir = hdr + list.length, z = Math.max(awal, akhir)
  const lebar = [7, 30, 32, 15, 15, 17, 26, 19]; lebar.forEach((w, k) => { ws.getColumn(k + 1).width = w })
  ;['No', 'Nama', 'Nama perusahaan', 'No. tiket', 'Status', 'Hadir sebagai', 'Nama perwakilan', 'Waktu check-in'].forEach((t, k) => { const c = ws.getCell(hdr, k + 1); c.value = t; header(c) }); ws.getRow(hdr).height = 32
  list.forEach((o, r) => { const row = awal + r, c = cekin.get(o.id + '|' + d)
    const v = [r + 1, o.nama, o.inst, o.kode, c ? 'Hadir' : 'Belum hadir', c ? (c.isRepresentative ? 'Perwakilan' : 'Peserta') : '', c?.representativeName || '', lokal(c?.checkedInAt)]
    v.forEach((x, k) => { const cell = ws.getCell(row, k + 1); cell.value = x; gaya(cell, { h: [1, 2].includes(k) || k === 6 ? 'left' : 'center', border: kotak, wrap: k !== 3, fmt: k === 7 ? FMT_WAKTU : undefined }) })
    ws.getRow(row).height = tinggiBaris(v, lebar) })
  // Rekap satu baris di atas tabel (baris kosong sebelum judul tabel), dihitung dari kolom Status dan Hadir sebagai
  const H = `COUNTIF(E${awal}:E${z},"Hadir")`, B = `COUNTIF(E${awal}:E${z},"Belum hadir")`, h = list.filter(o => cekin.has(o.id + '|' + d)).length, w = list.filter(o => cekin.get(o.id + '|' + d)?.isRepresentative).length
  const rc = ws.getCell(m - 1, 1)
  rc.value = { formula: `"Hadir "&${H}&" dari "&(${H}+${B})&" peserta   ·   Lewat perwakilan "&COUNTIF(F${awal}:F${z},"Perwakilan")&"   ·   Belum hadir "&${B}&"   ·   Tingkat kehadiran "&TEXT(IF(${H}+${B}=0,0,${H}/(${H}+${B})),"0.0%")`,
    result: `Hadir ${h} dari ${list.length} peserta   ·   Lewat perwakilan ${w}   ·   Belum hadir ${list.length - h}   ·   Tingkat kehadiran ${(list.length ? h / list.length * 100 : 0).toFixed(1)}%` }
  gaya(rc, { bold: true, wrap: false }); ws.getRow(m - 1).height = 20
  if (list.length) {
    ws.addConditionalFormatting({ ref: `E${awal}:E${akhir}`, rules: [
      { type: 'cellIs', operator: 'equal', formulae: ['"Hadir"'], priority: 1, style: { font: { bold: true } } },
      { type: 'cellIs', operator: 'equal', formulae: ['"Belum hadir"'], priority: 2, style: { font: { italic: true, color: { argb: C.muted } } } }] })
    ws.addConditionalFormatting({ ref: `F${awal}:F${akhir}`, rules: [{ type: 'cellIs', operator: 'equal', formulae: ['"Perwakilan"'], priority: 3, style: { font: { bold: true } } }] })
    ws.autoFilter = `A${hdr}:H${akhir}`
  }
  // Tanpa pembekuan baris/kolom: tampilan seperti Excel baru dibuka, semua bergeser bersama sehingga tidak ada bagian yang terpotong
  ws.views = [{ showGridLines: false }]
  aturCetak(ws, { landscape: true, judulBaris: `${hdr}:${hdr}`, footer: `Laporan Kehadiran ${label}` })
  return ws
}

// Lembar riwayat check-in (kronologis); cs boleh sudah disaring untuk satu hari
function lembarRiwayat(wb, { sem, days, tanggal, multi, cs, hariLabel, ckDay, showCode, catatan = [] }) {
  const rw = wb.addWorksheet('Riwayat check-in', { views: [{ showGridLines: false }] })
  const urutan = [...cs].sort((x, y) => (x.checkedInAt?.toMillis?.() ?? 0) - (y.checkedInAt?.toMillis?.() ?? 0))
  const kolR = [['No', 7], ['Waktu', 20], ...(multi ? [['Hari', 18]] : []), ['Nama peserta', 30], ['No. tiket', 15], ['Hadir sebagai', 17], ['Nama perwakilan', 26], ['Cara', 11], ['Petugas', 30]]
  const hr = blokJudul(rw, 'Riwayat Check-in', { sem, tanggal }, [[...catatan, 'Urut dari yang paling awal', `Dibuat ${dibuat()}`].join('   ·   ')]) + 1
  kolR.forEach(([t, w], i) => { rw.getColumn(i + 1).width = w; const c = rw.getCell(hr, i + 1); c.value = t; header(c) }); rw.getRow(hr).height = 32
  urutan.forEach((c, i) => { const row = hr + 1 + i, v = [i + 1, lokal(c.checkedInAt), ...(multi ? [hariLabel(days, ckDay(c, days))] : []), c.participantName || '', c.ticketId ? showCode(c.ticketId) : '',
      c.isRepresentative ? 'Perwakilan' : 'Peserta', c.representativeName || '', c.via === 'manual' ? 'Manual' : 'QR', c.officerEmail || '']
    v.forEach((x, j) => { const cell = rw.getCell(row, j + 1), kolom = kolR[j][0]; cell.value = x
      gaya(cell, { border: kotak, wrap: kolom !== 'No. tiket', h: ['No', 'Waktu', 'Hari', 'No. tiket', 'Hadir sebagai', 'Cara'].includes(kolom) ? 'center' : 'left', fmt: kolom === 'Waktu' ? FMT_WAKTU : undefined, ...(kolom === 'Hadir sebagai' && x === 'Perwakilan' ? { bold: true } : {}) }) })
    rw.getRow(row).height = tinggiBaris(v, kolR.map(k => k[1])) })
  if (urutan.length) rw.autoFilter = `A${hr}:${kol(kolR.length)}${hr + urutan.length}`
  rw.views = [{ showGridLines: false }]
  aturCetak(rw, { landscape: true, judulBaris: `${hr}:${hr}`, footer: 'Riwayat Check-in' })
  return rw
}

// ---------------------------------------------------------------------------------------------------------------------
// Laporan kehadiran: lembar Ringkasan (rumus), Kehadiran (per peserta), Riwayat check-in (kronologis)
export function buatLaporan(ExcelJS, { sem = {}, days, ps, cs, ts, hariLabel, ckDay, showCode, tgl, hariBoleh = () => true }) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Registrasi Seminar'; wb.created = new Date()
  const { multi, tanggal, orang, cekin, dihapus, n } = siapkan({ days, ps, cs, ts, ckDay, showCode, tgl, hariBoleh })
  const rs = wb.addWorksheet('Ringkasan', { views: [{ showGridLines: false }] }), ws = wb.addWorksheet('Kehadiran', { views: [{ showGridLines: false }] })

  // ----- lembar Kehadiran -----
  const base = 4, per = 4, totalKol = base + per * days.length + 1, nKol = multi ? totalKol : base + per * days.length
  const mulai = blokJudul(ws, 'Laporan Kehadiran', { sem, tanggal }, [`Dibuat ${dibuat()}`])
  const hdr = mulai + (multi ? 1 : 0), awal = hdr + 1, akhir = hdr + n
  const kS = (i) => base + 1 + per * i        // kolom status untuk hari ke-i (disusul Hadir sebagai, Nama perwakilan, Waktu)
  const lebar = [7, 30, 32, 15]; days.forEach(() => lebar.push(15, 17, 26, 19)); if (multi) lebar.push(14)   // sedikit lebih lebar agar judul tidak tertutup tombol filter
  lebar.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  const dasar = ['No', 'Nama', 'Nama perusahaan', 'No. tiket'], sub = ['Status', 'Hadir sebagai', 'Nama perwakilan', 'Waktu check-in']
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
    days.forEach(d => { const c = cekin.get(o.id + '|' + d); vals.push(c ? 'Hadir' : o.boleh(d) ? 'Belum hadir' : '-', c ? (c.isRepresentative ? 'Perwakilan' : 'Peserta') : '', c?.representativeName || '', lokal(c?.checkedInAt)) })
    vals.forEach((v, i) => { const cell = ws.getCell(row, i + 1), tengah = i === 0 || i === 3 || (i >= base && (i - base) % per !== 2)
      cell.value = v; gaya(cell, { h: tengah ? 'center' : 'left', border: kotak, wrap: i !== 3, fmt: i >= base && (i - base) % per === 3 ? FMT_WAKTU : undefined }) })
    if (multi) { const cell = ws.getCell(row, totalKol), rumus = days.map((_, i) => `(${kol(kS(i))}${row}="Hadir")`).join('+')
      cell.value = { formula: rumus, result: days.filter(d => cekin.has(o.id + '|' + d)).length }; gaya(cell, { h: 'center', bold: true, border: kotak }) }
    ws.getRow(row).height = tinggiBaris(vals, lebar) })
  if (n) {
    days.forEach((_, i) => {
      ws.addConditionalFormatting({ ref: `${kol(kS(i))}${awal}:${kol(kS(i))}${akhir}`, rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['"Hadir"'], priority: 1, style: { font: { bold: true } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"Belum hadir"'], priority: 2, style: { font: { italic: true, color: { argb: C.muted } } } },
        { type: 'cellIs', operator: 'equal', formulae: ['"-"'], priority: 4, style: { font: { color: { argb: C.muted } } } }] })
      ws.addConditionalFormatting({ ref: `${kol(kS(i) + 1)}${awal}:${kol(kS(i) + 1)}${akhir}`, rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['"Perwakilan"'], priority: 3, style: { font: { bold: true } } }] })
    })
    ws.autoFilter = `A${hdr}:${kol(nKol)}${akhir}`
  }
  // Tanpa pembekuan baris/kolom: tampilan seperti Excel baru dibuka, semua bergeser bersama sehingga tidak ada bagian yang terpotong
  ws.views = [{ showGridLines: false }]
  aturCetak(ws, { landscape: true, judulBaris: multi ? `${hdr - 1}:${hdr}` : `${hdr}:${hdr}`, footer: 'Laporan Kehadiran' })

  // ----- satu lembar per hari (hanya bila kegiatan lebih dari satu hari) -----
  if (multi) days.forEach((d, i) => lembarHari(wb, { sem, days, tgl, hariLabel, orang, cekin }, d, i))

  // ----- lembar Ringkasan (angka dihitung dengan rumus dari lembar Kehadiran) -----
  // Kedua tabel memakai enam kolom yang sama (label, total, hadir, perwakilan, belum hadir, persen) agar sejajar dan rapi.
  const a = awal, z = Math.max(awal, akhir), R = (k) => `Kehadiran!$${kol(k)}$${a}:$${kol(k)}$${z}`
  let r = blokJudul(rs, 'Laporan Kehadiran', { sem, tanggal }, [`Dibuat ${dibuat()}`])
  const wRs = [38, 14, 16, 18, 14, 18]; wRs.forEach((w, i) => { rs.getColumn(i + 1).width = w })
  const judulTabel = (t) => { const c = rs.getCell(r, 1); c.value = t; gaya(c, { bold: true, size: 12, color: C.ink, wrap: false }); rs.getRow(r).height = 22; r++ }
  const kepala = (labels) => { labels.forEach((t, i) => { const c = rs.getCell(r, i + 1); c.value = t; header(c) }); rs.getRow(r).height = 32; r++ }
  const sel = (rr, cc, v, o = {}) => { const c = rs.getCell(rr, cc); c.value = v; gaya(c, { border: kotak, ...o }); return c }
  const stat = days.map(d => { let h = 0, w = 0; orang.forEach(o => { const c = cekin.get(o.id + '|' + d); if (c) { h++; if (c.isRepresentative) w++ } }); return { h, w } })
  const tot = days.map(d => orang.filter(o => cekin.has(o.id + '|' + d) || o.boleh(d)).length)   // peserta yang dijadwalkan pada hari itu
  const pct = (b, c) => b ? c / b : 0
  judulTabel('Rekap kehadiran per hari'); kepala(['Hari', 'Total peserta', 'Hadir', 'Lewat perwakilan', 'Belum hadir', 'Tingkat kehadiran'])
  days.forEach((d, i) => { sel(r, 1, (multi ? `Hari ${i + 1}` : 'Hari kegiatan') + (/^\d{4}-/.test(d) ? ` · ${tgl(d)}` : ''), { bold: true })
    sel(r, 2, { formula: `COUNTIF(${R(kS(i))},"Hadir")+COUNTIF(${R(kS(i))},"Belum hadir")`, result: tot[i] }, { h: 'center' })
    sel(r, 3, { formula: `COUNTIF(${R(kS(i))},"Hadir")`, result: stat[i].h }, { h: 'center', bold: true })
    sel(r, 4, { formula: `COUNTIF(${R(kS(i) + 1)},"Perwakilan")`, result: stat[i].w }, { h: 'center' })
    sel(r, 5, { formula: `B${r}-C${r}`, result: tot[i] - stat[i].h }, { h: 'center', color: C.muted })
    sel(r, 6, { formula: `IF(B${r}=0,0,C${r}/B${r})`, result: pct(tot[i], stat[i].h) }, { h: 'center', bold: true, fmt: '0.0%' }); rs.getRow(r).height = 20; r++ })
  if (multi) {   // peserta yang dijadwalkan di semua hari, dan berapa yang hadir di setiap harinya
    const jadwal = orang.filter(o => days.every(d => cekin.has(o.id + '|' + d) || o.boleh(d))).length, semua = orang.filter(o => days.every(d => cekin.has(o.id + '|' + d))).length
    sel(r, 1, 'Hadir di semua hari', { bold: true })
    sel(r, 2, { formula: `SUMPRODUCT(${days.map((_, i) => `(${R(kS(i))}<>"-")`).join('*')})`, result: jadwal }, { h: 'center' })
    sel(r, 3, { formula: `COUNTIF(${R(totalKol)},${days.length})`, result: semua }, { h: 'center', bold: true })
    sel(r, 4, '-', { h: 'center', color: C.muted })
    sel(r, 5, { formula: `B${r}-C${r}`, result: jadwal - semua }, { h: 'center', color: C.muted })
    sel(r, 6, { formula: `IF(B${r}=0,0,C${r}/B${r})`, result: pct(jadwal, semua) }, { h: 'center', bold: true, fmt: '0.0%' }); rs.getRow(r).height = 20; r++ }
  r++; judulTabel('Rekap per perusahaan'); kepala(['Nama perusahaan', 'Peserta', multi ? 'Hadir (min. 1 hari)' : 'Hadir', 'Lewat perwakilan', 'Belum hadir', 'Tingkat kehadiran'])
  const grup = new Map(); orang.forEach(o => { const g = grup.get(o.inst) || { p: 0, h: 0, w: 0 }; g.p++; if (days.some(d => cekin.has(o.id + '|' + d))) g.h++; if (days.some(d => cekin.get(o.id + '|' + d)?.isRepresentative)) g.w++; grup.set(o.inst, g) })
  const daftar = [...grup].sort((x, y) => y[1].p - x[1].p || x[0].localeCompare(y[0], 'id')), r0 = r
  daftar.forEach(([inst, g]) => { sel(r, 1, inst, { bold: true })
    sel(r, 2, { formula: `SUMPRODUCT(--(${R(3)}=A${r}))`, result: g.p }, { h: 'center' })
    sel(r, 3, { formula: multi ? `SUMPRODUCT((${R(3)}=A${r})*(${R(totalKol)}>0))` : `SUMPRODUCT((${R(3)}=A${r})*(${R(kS(0))}="Hadir"))`, result: g.h }, { h: 'center', bold: true })
    sel(r, 4, { formula: `SUMPRODUCT((${R(3)}=A${r})*((${days.map((_, i) => `(${R(kS(i) + 1)}="Perwakilan")`).join('+')})>0))`, result: g.w }, { h: 'center' })
    sel(r, 5, { formula: `B${r}-C${r}`, result: g.p - g.h }, { h: 'center', color: C.muted })
    sel(r, 6, { formula: `IF(B${r}=0,0,C${r}/B${r})`, result: pct(g.p, g.h) }, { h: 'center', fmt: '0.0%' }); rs.getRow(r).height = tinggiBaris([inst], [wRs[0]], 20); r++ })
  if (daftar.length) { const tp = daftar.reduce((s, x) => s + x[1].p, 0), th = daftar.reduce((s, x) => s + x[1].h, 0), tw = daftar.reduce((s, x) => s + x[1].w, 0), t = { bold: true, h: 'center' }
    sel(r, 1, 'Jumlah', { bold: true }); sel(r, 2, { formula: `SUM(B${r0}:B${r - 1})`, result: tp }, t); sel(r, 3, { formula: `SUM(C${r0}:C${r - 1})`, result: th }, t)
    sel(r, 4, { formula: `SUM(D${r0}:D${r - 1})`, result: tw }, t); sel(r, 5, { formula: `B${r}-C${r}`, result: tp - th }, t)
    sel(r, 6, { formula: `IF(B${r}=0,0,C${r}/B${r})`, result: pct(tp, th) }, { ...t, fmt: '0.0%' }); rs.getRow(r).height = 20; r++ }
  r++; const catatan = ['Catatan:', 'Angka di lembar ini dihitung otomatis dari lembar Kehadiran, jadi ikut berubah bila data di sana diedit.',
    'Lewat perwakilan: peserta hadir diwakili orang lain; nama perwakilan tercatat di lembar Kehadiran.',
    ...(multi ? ['Kehadiran dicatat per hari. Tanda "-" pada lembar Kehadiran berarti peserta tidak dijadwalkan pada hari itu, dan tidak dihitung sebagai belum hadir.',
      'Baris "Hadir di semua hari": Total = peserta yang dijadwalkan di semua hari, Hadir = yang hadir pada setiap hari tersebut.'] : []),
    ...(dihapus.length ? ['Baris "(peserta sudah dihapus)" adalah peserta yang sempat check-in lalu dihapus dari daftar; tetap dihitung agar laporan sesuai kenyataan.'] : [])]
  catatan.forEach((t, i) => { const rr = r + i, c = rs.getCell(rr, 1); c.value = t; gaya(c, { color: C.muted, bold: i === 0, size: 9, v: 'top' }); rs.mergeCells(rr, 1, rr, 6); rs.getRow(rr).height = t.length > 170 ? 26 : 14 })
  aturCetak(rs, { landscape: false, footer: 'Laporan Kehadiran' })

  // ----- lembar Riwayat check-in -----
  lembarRiwayat(wb, { sem, days, tanggal, multi, cs, hariLabel, ckDay, showCode })
  return wb
}

// ---------------------------------------------------------------------------------------------------------------------
// Laporan SATU hari saja (file terpisah): lembar kehadiran hari itu + riwayat check-in hari itu
export function buatLaporanHari(ExcelJS, { sem = {}, days, ps, cs, ts, hariLabel, ckDay, showCode, tgl, hariBoleh = () => true, hari }) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Registrasi Seminar'; wb.created = new Date()
  const bahan = siapkan({ days, ps, cs, ts, ckDay, showCode, tgl, hariBoleh }), i = Math.max(0, days.indexOf(hari))
  lembarHari(wb, { sem, days, tgl, hariLabel, orang: bahan.orang, cekin: bahan.cekin }, hari, i)
  lembarRiwayat(wb, { sem, days: [hari], tanggal: /^\d{4}-/.test(hari) ? tgl(hari) : '', multi: false, cs: cs.filter(c => ckDay(c, days) === hari), hariLabel, ckDay: () => hari, showCode, catatan: [hariLabel(days, hari)] })
  return wb
}

// ---------------------------------------------------------------------------------------------------------------------
// Daftar hadir cadangan: nama, perusahaan, bidang, nomor tiket, dan kolom paraf yang lega untuk ditulis tangan
export function buatCadangan(ExcelJS, { sem = {}, days, ps, ts, hariLabel, showCode, tgl, hariBoleh = () => true }) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Registrasi Seminar'; wb.created = new Date()
  const ws = wb.addWorksheet('Daftar hadir', { views: [{ showGridLines: false }] }), multi = days.length > 1
  const tanggal = days.filter(d => /^\d{4}-/.test(d)).map(tgl).join(' dan ')
  const kode = Object.fromEntries(ts.filter(t => t.status !== 'dicabut').map(t => [t.participantId, showCode(t.id)]))
  const list = [...ps].sort((x, y) => (x.name || '').localeCompare(y.name || '', 'id'))
  const hdr = blokJudul(ws, 'Daftar Hadir', { sem, tanggal }, ['Cadangan bila internet bermasalah. Cocokkan nomor tiket dengan tiket peserta, lalu minta paraf. Perwakilan: tulis namanya di kolom keterangan.', ...(multi ? ['Tanda "—" berarti peserta tidak dijadwalkan pada hari itu.'] : [])])
  const kolom = [['No', 6], ['Nama', 30], ['Nama perusahaan', 30], ['Bidang perusahaan', 24], ['No. tiket', 15], ...days.map((d) => [multi ? `Paraf\n${hariLabel(days, d)}` : 'Paraf', 22]), ['Keterangan / nama perwakilan', 30]]
  kolom.forEach(([t, w], i) => { ws.getColumn(i + 1).width = w; const c = ws.getCell(hdr, i + 1); c.value = t; header(c) }); ws.getRow(hdr).height = 34
  list.forEach((p, r) => { const row = hdr + 1 + r, v = [r + 1, p.name || '', p.institution || '', p.bidang || '', kode[p.id] || '(belum ada tiket)', ...days.map(d => hariBoleh(p, d, days) ? '' : '—'), '']
    v.forEach((x, i) => { const c = ws.getCell(row, i + 1); c.value = x; gaya(c, { border: kotak, h: i === 0 || i === 4 || x === '—' ? 'center' : 'left', ...(x === '—' ? { color: C.muted } : {}) }) }); ws.getRow(row).height = Math.max(26, tinggiBaris(v, kolom.map(k => k[1]))) })
  ws.views = [{ showGridLines: false }]
  aturCetak(ws, { landscape: multi || days.length > 2, judulBaris: `${hdr}:${hdr}`, footer: 'Daftar Hadir' })
  return wb
}

// ---------------------------------------------------------------------------------------------------------------------
// Daftar peserta (menu Peserta, Export Excel): tabel rapi, WhatsApp disimpan sebagai teks agar angka di depan tidak hilang
export function buatPeserta(ExcelJS, { sem = {}, days = [], ps, hariTeks = () => '', tgl = () => '' }) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Registrasi Seminar'; wb.created = new Date()
  const ws = wb.addWorksheet('Peserta', { views: [{ showGridLines: false }] }), multi = days.length > 1
  const tanggal = days.filter(d => /^\d{4}-/.test(d)).map(tgl).join(' dan ')
  const list = [...ps].sort((x, y) => (x.name || '').localeCompare(y.name || '', 'id'))
  const kolom = [['No', 6], ['Nama', 30], ['Nama perusahaan', 30], ['Bidang perusahaan', 24], ['WhatsApp', 16], ['Email', 32], ...(multi ? [['Hari', 14]] : []), ['Status', 12], ['Terdaftar', 17]]
  const hdr = blokJudul(ws, 'Daftar Peserta', { sem, tanggal }, [`Total ${list.length} peserta`, `Dibuat ${dibuat()}`])
  kolom.forEach(([t, w], i) => { ws.getColumn(i + 1).width = w; const c = ws.getCell(hdr, i + 1); c.value = t; header(c) }); ws.getRow(hdr).height = 28
  const tengah = ['No', 'WhatsApp', 'Hari', 'Status', 'Terdaftar']
  list.forEach((p, r) => { const row = hdr + 1 + r, st = p.status || 'terdaftar'
    const v = [r + 1, p.name || '', p.institution || '', p.bidang || '', p.whatsapp || '', p.email || '', ...(multi ? [hariTeks(p, days)] : []), st.charAt(0).toUpperCase() + st.slice(1), lokal(p.createdAt)]
    v.forEach((x, i) => { const c = ws.getCell(row, i + 1), k = kolom[i][0]; c.value = x
      gaya(c, { border: kotak, h: tengah.includes(k) ? 'center' : 'left', fmt: k === 'WhatsApp' ? '@' : k === 'Terdaftar' ? FMT_WAKTU : undefined }) })
    ws.getRow(row).height = tinggiBaris(v, kolom.map(k => k[1])) })
  if (list.length) ws.autoFilter = `A${hdr}:${kol(kolom.length)}${hdr + list.length}`
  ws.views = [{ showGridLines: false }]
  aturCetak(ws, { landscape: true, judulBaris: `${hdr}:${hdr}`, footer: 'Daftar Peserta' })
  return wb
}

// Template import: lembar pertama "Peserta" (yang dibaca halaman Import), lembar kedua berisi petunjuk pengisian
export function buatTemplate(ExcelJS) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Registrasi Seminar'; wb.created = new Date()
  const ws = wb.addWorksheet('Peserta'), pt = wb.addWorksheet('Petunjuk', { views: [{ showGridLines: false }] })
  const kolom = [['Nama', 30], ['Email', 32], ['WhatsApp', 18], ['Nama Perusahaan', 32], ['Bidang Perusahaan', 28], ['Hari', 10]]
  kolom.forEach(([t, w], i) => { ws.getColumn(i + 1).width = w; const c = ws.getCell(1, i + 1); c.value = t; header(c) }); ws.getRow(1).height = 26
  ws.getColumn(3).numFmt = '@'   // WhatsApp sebagai teks: angka 0 di depan (08...) tidak hilang
  for (let i = 2; i <= 500; i++) ws.getCell(`F${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"1,2"'], showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Kolom Hari', error: 'Isi 1 atau 2, atau kosongkan bila hadir di kedua hari.' }
  ws.views = [{ state: 'frozen', ySplit: 1 }]; aturCetak(ws, { landscape: true, judulBaris: '1:1', footer: 'Template Peserta' }); ws.pageSetup.printArea = 'A1:F40'
  pt.getColumn(1).width = 110
  ;[['Petunjuk pengisian', { bold: true, size: 14 }],
    ['Isi data peserta di lembar "Peserta", satu baris untuk satu peserta. Jangan mengubah judul kolom di baris pertama. Baris kosong dilewati.', {}],
    ['Hanya Nama yang wajib diisi. Email, WhatsApp, Nama Perusahaan, dan Bidang Perusahaan boleh kosong.', {}],
    ['WhatsApp (bila diisi): nomor HP berawalan 08 atau 628, contoh 08123456789 atau 628123456789. Satu nomor hanya boleh dipakai satu peserta.', {}],
    ['Hari (hanya bila kegiatan berlangsung 2 hari): isi 1 atau 2 bila peserta hanya hadir di salah satu hari. Kosongkan bila hadir di kedua hari.', {}],
    ['Setelah selesai, simpan file lalu unggah di menu Peserta, Import Excel.', {}]].forEach(([t, o], i) => { const c = pt.getCell(i + 1, 1); c.value = t; gaya(c, { ...o, v: 'top' }); pt.getRow(i + 1).height = o.size ? 26 : t.length > 105 ? 32 : 20 })
  return wb
}

// ---------------------------------------------------------------------------------------------------------------------
async function simpan(wb, berkas) {
  const buf = await wb.xlsx.writeBuffer(), url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = berkas; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000)
}
const muat = async () => (await import('exceljs')).default
export async function unduhLaporan(d) { const wb = buatLaporan(await muat(), d); await simpan(wb, `laporan-kehadiran-${nama(d.sem?.title)}-${hariIni()}.xlsx`) }
export async function unduhLaporanHari(d) { const wb = buatLaporanHari(await muat(), d); await simpan(wb, `laporan-kehadiran-${nama(d.sem?.title)}-hari-${d.days.indexOf(d.hari) + 1}-${/^\d{4}-/.test(d.hari) ? d.hari : hariIni()}.xlsx`) }
export async function unduhPeserta(d) { const wb = buatPeserta(await muat(), d); await simpan(wb, `daftar-peserta-${nama(d.sem?.title)}-${hariIni()}.xlsx`) }
export async function unduhTemplate() { const wb = buatTemplate(await muat()); await simpan(wb, 'template-peserta.xlsx') }
export async function unduhCadangan(d) { const wb = buatCadangan(await muat(), d); await simpan(wb, `daftar-hadir-cadangan-${nama(d.sem?.title)}.xlsx`) }
