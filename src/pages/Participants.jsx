import { useDialog } from '../ui'
import { Badge } from '../ui'
import { useState } from 'react'; import { Link } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import * as XLSX from 'xlsx'; import { db } from '../firebase'; import { useCol, fmt } from '../hooks'
const empty = { name:'', email:'', whatsapp:'', institution:'', status:'terdaftar' }
export default function Participants() {
  const ask = useDialog()
  const rows = useCol('participants', 'createdAt'), [f, setF] = useState(empty), [q, setQ] = useState(''), [edit, setEdit] = useState(null)
  const save = async (e) => { e.preventDefault()
    if (edit) await updateDoc(doc(db,'participants',edit), f)
    else await addDoc(collection(db,'participants'), { ...f, createdAt: serverTimestamp() })
    setF(empty); setEdit(null) }
  const exp = () => { const ws = XLSX.utils.json_to_sheet(rows.map(r => ({ ID:r.id, Nama:r.name, Email:r.email, WhatsApp:r.whatsapp, Instansi:r.institution, Status:r.status, Terdaftar:fmt(r.createdAt) })))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Peserta'); XLSX.writeFile(wb, 'peserta.xlsx') }
  const list = rows.filter(r => (r.name+r.email+r.institution).toLowerCase().includes(q.toLowerCase()))
  return <><div className="d-flex gap-2 mb-3 flex-wrap"><h1 className="h4 me-auto">Peserta ({rows.length})</h1>
    <Link className="btn btn-outline-primary btn-sm" to="/admin/participants/import">Import Excel</Link>
    <button className="btn btn-outline-secondary btn-sm" onClick={exp}>Export Excel</button></div>
    <div className="panel"><form className="row g-2" onSubmit={save}>
      {[['name','Nama lengkap'],['email','Email'],['whatsapp','WhatsApp (628…)'],['institution','Asal instansi']].map(([k,p]) =>
        <div className="col-md" key={k}><input className="form-control" placeholder={p} value={f[k]} required={k==='name'} onChange={e=>setF({...f,[k]:e.target.value})}/></div>)}
      <div className="col-auto"><button className="btn btn-primary">{edit ? 'Simpan perubahan' : 'Tambah peserta'}</button></div></form></div>
    <input className="form-control mb-2" placeholder="Cari nama, email, instansi" value={q} onChange={e=>setQ(e.target.value)}/>
    <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Nama</th><th>Email</th><th>WhatsApp</th><th>Instansi</th><th>Status</th><th/></tr></thead><tbody>
      {list.map(r => <tr key={r.id}><td>{r.name}</td><td>{r.email}</td><td>{r.whatsapp}</td><td>{r.institution}</td><td><Badge s={r.status}/></td>
        <td className="text-end"><button className="btn btn-link btn-sm" onClick={()=>{setEdit(r.id);setF({name:r.name,email:r.email||'',whatsapp:r.whatsapp||'',institution:r.institution||'',status:r.status||'terdaftar'})}}>Ubah</button>
        <button className="btn btn-link btn-sm text-danger" onClick={async()=>{ if (await ask({ title:'Hapus peserta?', text:`${r.name} akan dihapus dari daftar. Tiket yang sudah dibuat tidak ikut terhapus.`, ok:'Hapus', danger:true })) deleteDoc(doc(db,'participants',r.id)) }}>Hapus</button></td></tr>)}
      {!list.length && <tr><td colSpan="6" className="text-center text-muted py-4">Belum ada peserta. Tambahkan manual atau import Excel.</td></tr>}</tbody></table></div></>
}
