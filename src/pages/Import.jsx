import { useState } from 'react'; import * as XLSX from 'xlsx'
import { addDoc, collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'; import { auth, db } from '../firebase'; import { Skel } from '../ui'; import { useColState, waNumber, validWa, validEmail } from '../hooks'
const key = (r) => r.whatsapp
// Judul kolom dibandingkan tanpa huruf besar/kecil, spasi, dan tanda baca: "Whatsapp", "No. HP", atau "nama lengkap" tetap terbaca
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
const ALIAS = { name: ['nama', 'namalengkap', 'name'], email: ['email', 'surel', 'alamatemail'], whatsapp: ['whatsapp', 'wa', 'nowa', 'nohp', 'nomorhp', 'nomorwa', 'nomorwhatsapp', 'hp', 'telepon', 'phone'], institution: ['instansi', 'asalinstansi', 'institusi', 'organisasi', 'institution'] }
const ambil = (x, k) => { const h = Object.keys(x).find(c => ALIAS[k].includes(norm(c))); return h === undefined ? '' : x[h] }
const pesanError = (ex) => ex?.code === 'permission-denied' ? 'ditolak oleh aturan Firestore (periksa role/active akun dan pastikan firestore.rules sudah di-Publish)' : `${ex?.code || ''} ${ex?.message || ex}`.trim()
export default function Import() {
  const [existing, loadEx] = useColState('participants'), [reading, setReading] = useState(false), [rows, setRows] = useState([]), [skipped, setSkipped] = useState(0), [bad, setBad] = useState([]), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const read = async (e) => { const f = e.target.files[0]; if (!f || loadEx) return; setMsg(''); setErr(''); setRows([]); setSkipped(0); setBad([]); setReading(true)
    try {
      const wb = XLSX.read(await f.arrayBuffer()), j = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      const heads = new Set(j.flatMap(x => Object.keys(x)).map(norm))
      if (!ALIAS.name.some(a => heads.has(a)) || !ALIAS.whatsapp.some(a => heads.has(a))) throw new Error('Kolom Nama dan WhatsApp tidak ditemukan di baris pertama. Gunakan template (tombol Unduh template).')
      const seen = new Set(existing.map(r => waNumber(r.whatsapp))), ok = [], badRows = []; let dup = 0
      j.forEach((x, i) => { const r = { name: String(ambil(x, 'name') || '').trim(), email: String(ambil(x, 'email') || '').trim(), whatsapp: waNumber(String(ambil(x, 'whatsapp') || '')), institution: String(ambil(x, 'institution') || '').trim() }, line = i + 2
        if (!r.name && !r.whatsapp && !r.email) return
        if (!r.name) return badRows.push(`Baris ${line}: nama kosong`)
        if (!validWa(r.whatsapp)) return badRows.push(`Baris ${line} (${r.name}): nomor WhatsApp kosong atau tidak valid`)
        if (r.email && !validEmail(r.email)) return badRows.push(`Baris ${line} (${r.name}): format email tidak valid`)
        if (seen.has(key(r))) dup++; else { seen.add(key(r)); ok.push(r) } })
      setRows(ok); setSkipped(dup); setBad(badRows)
    } catch (ex) { setErr('File tidak bisa dibaca: ' + (ex.message || ex)) }
    setReading(false); e.target.value = '' }
  // Disimpan per 400 baris. Bila gagal di tengah jalan, baris yang sudah masuk dikeluarkan dari antrean sehingga "Import" bisa diulang tanpa duplikat.
  const go = async () => { setBusy(true); setErr(''); setMsg(''); let done = 0
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
  const tpl = () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Nama', 'Email', 'WhatsApp', 'Instansi']]), 'Peserta'); XLSX.writeFile(wb, 'template-peserta.xlsx') }
  return <><h1 className="h4 mb-3">Import peserta</h1>{msg && <div className="alert alert-success" role="status">{msg}</div>}{err && <div className="alert alert-danger" role="alert">{err}</div>}
    <p className="text-muted">Kolom wajib: Nama dan WhatsApp. Email dan Instansi boleh kosong. <button className="btn btn-link p-0" onClick={tpl}>Unduh template</button></p>
    {loadEx ? <Skel w="400px" h="2.4rem" r="8px" className="mb-3"/> : <input type="file" accept=".xlsx,.xls,.csv" className="form-control mb-3" style={{maxWidth:400}} disabled={busy} onChange={read}/>}
    {reading && <div aria-busy="true" aria-label="Membaca file"><Skel w="40%" className="mb-2"/><Skel h="1.1rem" className="mb-1"/><Skel h="1.1rem" className="mb-1"/><Skel h="1.1rem" className="mb-3"/></div>}
    {skipped > 0 && <div className="alert alert-warning">{skipped} baris dilewati karena nomor WhatsApp sama (duplikat).</div>}
    {bad.length > 0 && <div className="alert alert-danger"><b>{bad.length} baris tidak diimport:</b><ul className="mb-0">{bad.slice(0, 10).map((m, i) => <li key={i}>{m}</li>)}</ul>{bad.length > 10 && <div>…dan {bad.length - 10} baris lainnya.</div>}</div>}
    {rows.length > 0 && <><p>{rows.length} baris siap diimport. Pratinjau 5 baris pertama:</p>
      <div className="table-responsive"><table className="table table-sm"><tbody>{rows.slice(0,5).map((r,i)=><tr key={i}><td>{r.name}</td><td>{r.email}</td><td>{r.whatsapp}</td><td>{r.institution}</td></tr>)}</tbody></table></div>
      <button className={'btn btn-primary' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={busy} onClick={go}>{`Import ${rows.length} peserta`}</button></>}</>
}
