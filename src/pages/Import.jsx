import { useState } from 'react'; import * as XLSX from 'xlsx'
import { addDoc, collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'; import { auth, db } from '../firebase'; import { Skel } from '../ui'; import { useColState, useSeminar, hariList, hariTeks, waNumber, validWa, validEmail } from '../hooks'
const key = (r) => r.whatsapp
// Judul kolom dibandingkan tanpa huruf besar/kecil, spasi, dan tanda baca: "Whatsapp", "No. HP", atau "nama lengkap" tetap terbaca
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
const ALIAS = { name: ['namapicadmin', 'namapic', 'pic', 'namaadmin', 'nama', 'namalengkap', 'name'], email: ['emailaddress', 'email', 'surel', 'alamatemail'], whatsapp: ['nohppicadmin', 'nohppic', 'nomorhppicadmin', 'whatsapp', 'wa', 'nowa', 'nohp', 'nomorhp', 'nomorwa', 'nomorwhatsapp', 'hp', 'telepon', 'phone'], institution: ['namaperusahaannamaindividu', 'namaperusahaan', 'namaindividu', 'perusahaan', 'company', 'instansi', 'asalinstansi', 'institusi', 'organisasi', 'institution'], pimpinan: ['namapimpinan', 'pimpinan', 'direktur', 'namadirektur', 'ketua'], domisili: ['domisili', 'alamat', 'kota', 'kotadomisili'], wilayah: ['wilayahoperasionalperusahaan', 'wilayahoperasional', 'wilayah', 'areaoperasional'], bidang: ['jenisusaha', 'bidangperusahaan', 'bidangusaha', 'bidang', 'sektor', 'industri', 'industry'], hari: ['hari', 'harike', 'hariacara', 'hadirhari'] }
const ambil = (x, k) => { const h = Object.keys(x).find(c => ALIAS[k].includes(norm(c))); return h === undefined ? '' : x[h] }
// Kolom Hari (opsional): 1, 2, "hari ke-2" = hanya hari itu; kosong, "1,2", "kedua", "semua" = kedua hari (disimpan kosong). null = tidak dikenali.
const parseHari = (v) => { const s = String(v ?? '').trim().toLowerCase(); if (!s) return ''
  if (/kedua|semua|both|all/.test(s)) return ''
  const n = [...new Set(s.match(/\d+/g) || [])]; if (!n.length || n.some(x => x !== '1' && x !== '2')) return null
  return n.length === 1 ? n[0] : '' }
const pesanError = (ex) => ex?.code === 'permission-denied' ? 'ditolak oleh aturan Firestore (periksa role/active akun dan pastikan firestore.rules sudah di-Publish)' : `${ex?.code || ''} ${ex?.message || ex}`.trim()
export default function Import() {
  const { sem } = useSeminar(), days = hariList(sem), multi = days.length > 1, [adaHari, setAdaHari] = useState(true)
  const [existing, loadEx] = useColState('participants'), [reading, setReading] = useState(false), [rows, setRows] = useState([]), [skipped, setSkipped] = useState(0), [bad, setBad] = useState([]), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [semua, setSemua] = useState(false), [raw, setRaw] = useState(null), [sama, setSama] = useState(0)
  // Memeriksa baris hasil baca file. Dipisah dari read() agar kotak "Import semua baris" bisa dicentang/dilepas kapan saja, termasuk setelah file dipilih.
  const proses = (j, semuaMode) => {
      const heads = new Set(j.flatMap(x => Object.keys(x)).map(norm))
      if (!ALIAS.name.some(a => heads.has(a))) throw new Error('Kolom Nama PIC/Admin tidak ditemukan di baris pertama. Gunakan template (tombol Unduh template).')
      const seen = new Set(existing.map(r => waNumber(r.whatsapp))), ok = [], badRows = []; let dup = 0, samaAda = 0
      // Peserta tanpa WhatsApp dianggap duplikat bila nama, email, dan perusahaan sama persis (email perusahaan boleh dipakai beberapa orang berbeda)
      const kunci2 = (r) => [r.name, r.email, r.institution].map(v => String(v || '').trim().toLowerCase()).join('|'), seen2 = new Set(existing.filter(r => !waNumber(r.whatsapp)).map(kunci2))
      const kunci3 = (r) => [r.whatsapp, r.name, r.email, r.institution].map(v => String(v || '').trim().toLowerCase()).join('|'), seenAll = new Set(existing.map(kunci3))
      j.forEach((x, i) => { const r = { name: String(ambil(x, 'name') || '').trim(), email: String(ambil(x, 'email') || '').trim(), whatsapp: waNumber(String(ambil(x, 'whatsapp') || '')), waAsli: String(ambil(x, 'whatsapp') || '').trim(), institution: String(ambil(x, 'institution') || '').trim(), pimpinan: String(ambil(x, 'pimpinan') || '').trim(), domisili: String(ambil(x, 'domisili') || '').trim(), wilayah: String(ambil(x, 'wilayah') || '').trim(), bidang: String(ambil(x, 'bidang') || '').trim() }, line = i + 2, hv = parseHari(ambil(x, 'hari')); r.hari = hv ?? ''
        if (!r.name && !r.whatsapp && !r.email) return
        if (!r.name) return badRows.push(`Baris ${line}: Nama PIC/Admin kosong`)
        if (hv === null) return badRows.push(`Baris ${line} (${r.name}): kolom Hari harus 1, 2, atau kosong (kedua hari)`)
        if (r.whatsapp && !validWa(r.whatsapp)) return badRows.push(`Baris ${line} (${r.name}): nomor WhatsApp bukan nomor HP (harus berawalan 08 atau 628)`)
        if (r.email && !validEmail(r.email)) return badRows.push(`Baris ${line} (${r.name}): format email tidak valid`)
        if (semuaMode) { if (seenAll.has(kunci3(r))) samaAda++; ok.push(r); return }   // mode "import semua": tidak ada baris yang dilewati, duplikat (nomor sama, bahkan data persis sama) tetap masuk
        if (r.whatsapp ? seen.has(key(r)) : seen2.has(kunci2(r))) dup++; else { if (r.whatsapp) seen.add(key(r)); else seen2.add(kunci2(r)); ok.push(r) } })
      setAdaHari(ALIAS.hari.some(a => heads.has(a))); setRows(ok); setSkipped(dup); setSama(samaAda); setBad(badRows) }
  const read = async (e) => { const f = e.target.files[0]; if (!f || loadEx) return; setMsg(''); setErr(''); setRows([]); setSkipped(0); setSama(0); setBad([]); setRaw(null); setReading(true)
    try {
      const wb = XLSX.read(await f.arrayBuffer()), j = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      proses(j, semua); setRaw(j)
    } catch (ex) { setErr('File tidak bisa dibaca: ' + (ex.message || ex)) }
    setReading(false); e.target.value = '' }
  const ubahSemua = (v) => { setSemua(v); if (!raw) return; setErr(''); try { proses(raw, v) } catch (ex) { setErr('File tidak bisa dibaca: ' + (ex.message || ex)) } }
  // Disimpan per 400 baris. Bila gagal di tengah jalan, baris yang sudah masuk dikeluarkan dari antrean sehingga "Import" bisa diulang tanpa duplikat.
  const go = async () => { setBusy(true); setErr(''); setMsg(''); setRaw(null); let done = 0
    try {
      for (let i = 0; i < rows.length; i += 400) { const part = rows.slice(i, i + 400), b = writeBatch(db)
        part.forEach(r => b.set(doc(collection(db, 'participants')), { ...r, status: 'terdaftar', createdAt: serverTimestamp() })); await b.commit(); done += part.length }
      setMsg(`${done} peserta berhasil diimport.`); setRows([])
    } catch (ex) {
      setRows(rows.slice(done))
      setErr(`${done ? `${done} peserta sudah masuk, ` : 'Belum ada peserta yang masuk, '}${rows.length - done} lainnya gagal: ${pesanError(ex)}. Tekan Import lagi untuk melanjutkan sisanya; yang sudah masuk tidak akan terduplikasi.`)
    }
    if (done) addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'import peserta', count: done }).catch(() => {})
    setBusy(false) }
  const tpl = async () => { try { const { unduhTemplate } = await import('../excel'); await unduhTemplate() } catch (ex) { setErr('Gagal membuat template: ' + (ex.message || ex)) } }
  return <><h1 className="h4 mb-3">Import peserta</h1>{msg && <div className="alert alert-success" role="status">{msg}</div>}{err && <div className="alert alert-danger" role="alert">{err}</div>}
    <p className="text-muted">Kolom file: Email Address, Nama Perusahaan/Nama Individu, Nama Pimpinan, Nama PIC/Admin, No HP PIC/Admin, Domisili, Wilayah Operasional Perusahaan, Jenis Usaha. Kolom wajib: Nama PIC/Admin saja, yang lain boleh kosong. Bila kegiatan 2 hari dan pesertanya berbeda tiap hari, isi kolom <b>Hari</b> dengan 1 atau 2 (kosong = hadir di kedua hari). <button className="btn btn-link p-0" onClick={tpl}>Unduh template</button></p>
    <div className="form-check mb-2"><input className="form-check-input" type="checkbox" id="semua" checked={semua} disabled={busy} onChange={e => ubahSemua(e.target.checked)}/><label className="form-check-label" htmlFor="semua">Import semua baris, termasuk duplikat (nomor WhatsApp sama atau data persis sama dengan peserta lain)</label></div>
    {loadEx ? <Skel w="400px" h="2.4rem" r="8px" className="mb-3"/> : <input type="file" accept=".xlsx,.xls,.csv" className="form-control mb-3" style={{maxWidth:400}} disabled={busy} onChange={read}/>}
    {reading && <div aria-busy="true" aria-label="Membaca file"><Skel w="40%" className="mb-2"/><Skel h="1.1rem" className="mb-1"/><Skel h="1.1rem" className="mb-1"/><Skel h="1.1rem" className="mb-3"/></div>}
    {semua && sama > 0 && <div className="alert alert-info">{sama} baris sama persis dengan peserta yang sudah ada di sistem, tetap ikut diimport karena mode <b>Import semua baris</b> aktif.</div>}
    {skipped > 0 && <div className="alert alert-warning">{skipped} baris dilewati karena duplikat (nomor WhatsApp sama, atau nama, email, dan perusahaan sama untuk peserta tanpa nomor).</div>}
    {bad.length > 0 && <div className="alert alert-danger"><b>{bad.length} baris tidak diimport:</b><ul className="mb-0">{bad.slice(0, 10).map((m, i) => <li key={i}>{m}</li>)}</ul>{bad.length > 10 && <div>…dan {bad.length - 10} baris lainnya.</div>}</div>}
    {rows.length > 0 && multi && !adaHari && <div className="alert alert-warning">Kolom <b>Hari</b> tidak ada di file ini, jadi semua peserta dianggap hadir di <b>kedua hari</b>. Tambahkan kolom Hari (1 atau 2) bila pesertanya berbeda tiap hari.</div>}
    {rows.length > 0 && <><p>{rows.length} baris siap diimport. Pratinjau 5 baris pertama:</p>
      <div className="table-responsive"><table className="table table-sm"><tbody>{rows.slice(0,5).map((r,i)=><tr key={i}><td>{r.email}</td><td>{r.institution}{r.pimpinan && <div className="small text-muted">{r.pimpinan}</div>}</td><td>{r.name}</td><td>{r.whatsapp}</td><td>{r.domisili}</td><td>{r.wilayah}</td><td>{r.bidang}</td>{multi && <td>{hariTeks(r, days)}</td>}</tr>)}</tbody></table></div>
      <button className={'btn btn-primary' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={busy} onClick={go}>{`Import ${rows.length} peserta`}</button></>}</>
}
