import { useState } from 'react'; import * as XLSX from 'xlsx'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'; import { db } from '../firebase'; import { useCol } from '../hooks'
const key = (r) => (r.email || r.whatsapp || r.name + '|' + r.institution).toLowerCase()
export default function Import() {
  const existing = useCol('participants'), [rows, setRows] = useState([]), [skipped, setSkipped] = useState(0), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const read = async (e) => { const f = e.target.files[0]; if (!f) return; setMsg('')
    const wb = XLSX.read(await f.arrayBuffer()), j = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
    const seen = new Set(existing.map(key)), ok = []; let dup = 0
    j.map(r => ({ name: String(r.Nama||'').trim(), email: String(r.Email||'').trim(), whatsapp: String(r.WhatsApp||'').replace(/\D/g,''), institution: String(r.Instansi||'').trim() }))
      .filter(r => r.name).forEach(r => { const k = key(r); if (seen.has(k)) dup++; else { seen.add(k); ok.push(r) } })
    setRows(ok); setSkipped(dup) }
  const go = async () => { setBusy(true)
    for (let i = 0; i < rows.length; i += 400) { const b = writeBatch(db)
      rows.slice(i, i+400).forEach(r => b.set(doc(collection(db,'participants')), { ...r, status:'terdaftar', createdAt: serverTimestamp() })); await b.commit() }
    setMsg(`${rows.length} peserta berhasil diimport.`); setRows([]); setBusy(false) }
  const tpl = () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Nama','Email','WhatsApp','Instansi']]), 'Peserta'); XLSX.writeFile(wb, 'template-peserta.xlsx') }
  return <><h1 className="h4 mb-3">Import peserta</h1>{msg && <div className="alert alert-success">{msg}</div>}
    <p className="text-muted">Gunakan kolom Nama, Email, WhatsApp, Instansi. <button className="btn btn-link p-0" onClick={tpl}>Unduh template</button></p>
    <input type="file" accept=".xlsx,.xls,.csv" className="form-control mb-3" style={{maxWidth:400}} onChange={read}/>
    {skipped > 0 && <div className="alert alert-warning">{skipped} baris dilewati karena duplikat (email, WhatsApp, atau nama dan instansi sama).</div>}
    {rows.length > 0 && <><p>{rows.length} baris siap diimport. Pratinjau 5 baris pertama:</p>
      <div className="table-responsive"><table className="table table-sm"><tbody>{rows.slice(0,5).map((r,i)=><tr key={i}><td>{r.name}</td><td>{r.email}</td><td>{r.whatsapp}</td><td>{r.institution}</td></tr>)}</tbody></table></div>
      <button className="btn btn-primary" disabled={busy} onClick={go}>{busy ? 'Mengimport…' : `Import ${rows.length} peserta`}</button></>}</>
}
