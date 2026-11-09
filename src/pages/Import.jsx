import { useState } from 'react'; import * as XLSX from 'xlsx'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'; import { db } from '../firebase'; import { useCol, waNumber, validWa, validEmail } from '../hooks'
const key = (r) => r.whatsapp
export default function Import() {
  const existing = useCol('participants'), [rows, setRows] = useState([]), [skipped, setSkipped] = useState(0), [bad, setBad] = useState([]), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const read = async (e) => { const f = e.target.files[0]; if (!f) return; setMsg('')
    const wb = XLSX.read(await f.arrayBuffer()), j = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
    const seen = new Set(existing.map(r => waNumber(r.whatsapp))), ok = [], badRows = []; let dup = 0
    j.forEach((x, i) => { const r = { name: String(x.Nama||'').trim(), email: String(x.Email||'').trim(), whatsapp: waNumber(String(x.WhatsApp||'')), institution: String(x.Instansi||'').trim() }, line = i + 2
      if (!r.name && !r.whatsapp && !r.email) return
      if (!r.name) return badRows.push(`Baris ${line}: nama kosong`)
      if (!validWa(r.whatsapp)) return badRows.push(`Baris ${line} (${r.name}): nomor WhatsApp kosong atau tidak valid`)
      if (r.email && !validEmail(r.email)) return badRows.push(`Baris ${line} (${r.name}): format email tidak valid`)
      if (seen.has(key(r))) dup++; else { seen.add(key(r)); ok.push(r) } })
    setRows(ok); setSkipped(dup); setBad(badRows) }
  const go = async () => { setBusy(true)
    for (let i = 0; i < rows.length; i += 400) { const b = writeBatch(db)
      rows.slice(i, i+400).forEach(r => b.set(doc(collection(db,'participants')), { ...r, status:'terdaftar', createdAt: serverTimestamp() })); await b.commit() }
    setMsg(`${rows.length} peserta berhasil diimport.`); setRows([]); setBusy(false) }
  const tpl = () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Nama','Email','WhatsApp','Instansi']]), 'Peserta'); XLSX.writeFile(wb, 'template-peserta.xlsx') }
  return <><h1 className="h4 mb-3">Import peserta</h1>{msg && <div className="alert alert-success">{msg}</div>}
    <p className="text-muted">Kolom wajib: Nama dan WhatsApp. Email dan Instansi boleh kosong. <button className="btn btn-link p-0" onClick={tpl}>Unduh template</button></p>
    <input type="file" accept=".xlsx,.xls,.csv" className="form-control mb-3" style={{maxWidth:400}} onChange={read}/>
    {skipped > 0 && <div className="alert alert-warning">{skipped} baris dilewati karena nomor WhatsApp sama (duplikat).</div>}
    {bad.length > 0 && <div className="alert alert-danger"><b>{bad.length} baris tidak diimport:</b><ul className="mb-0">{bad.slice(0, 10).map((m, i) => <li key={i}>{m}</li>)}</ul>{bad.length > 10 && <div>…dan {bad.length - 10} baris lainnya.</div>}</div>}
    {rows.length > 0 && <><p>{rows.length} baris siap diimport. Pratinjau 5 baris pertama:</p>
      <div className="table-responsive"><table className="table table-sm"><tbody>{rows.slice(0,5).map((r,i)=><tr key={i}><td>{r.name}</td><td>{r.email}</td><td>{r.whatsapp}</td><td>{r.institution}</td></tr>)}</tbody></table></div>
      <button className="btn btn-primary" disabled={busy} onClick={go}>{busy ? 'Mengimport…' : `Import ${rows.length} peserta`}</button></>}</>
}
