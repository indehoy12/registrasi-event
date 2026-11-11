import { useDialog, Badge, Skel, SkelRows } from '../ui'
import { useState } from 'react'; import { Link } from 'react-router-dom'
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import * as XLSX from 'xlsx'; import { auth, db } from '../firebase'; import { useColState, fmt, waNumber, validWa, validEmail, maskWa, maskEmail } from '../hooks'
const empty = { name:'', email:'', whatsapp:'', institution:'', status:'terdaftar' }
// Tiket menyimpan salinan nama, instansi, dan kontak (masked) peserta. Setelah data peserta diubah, salinan itu disamakan.
// Bila WhatsApp/email berganti, status kirim direset agar muncul lagi sebagai "Belum" di menu Distribusi.
async function syncTiket(id, d, lama) {
  const s = await getDocs(query(collection(db, 'tickets'), where('participantId', '==', id))); if (s.empty) return
  const b = writeBatch(db)
  s.docs.forEach(t => { const x = { participantName: d.name, institution: d.institution || '', emailMasked: maskEmail(d.email), waMasked: maskWa(d.whatsapp) }
    if (lama && waNumber(lama.whatsapp) !== d.whatsapp) { x.sentAt = null; x.sentVia = null }
    if (lama && (lama.email || '') !== d.email) x.emailSentAt = null
    b.update(t.ref, x) })
  await b.commit()
}
export default function Participants() {
  const ask = useDialog()
  const [rows, loading] = useColState('participants', 'createdAt'), [f, setF] = useState(empty), [q, setQ] = useState(''), [edit, setEdit] = useState(null), [err, setErr] = useState(''), [fe, setFe] = useState({})
  const save = async (e) => { e.preventDefault(); setErr('')
    const d = { ...f, name: f.name.trim(), email: f.email.trim(), institution: f.institution.trim(), whatsapp: waNumber(f.whatsapp) }, er = {}
    if (!d.name) er.name = 'Nama wajib diisi.'
    if (!d.whatsapp) er.whatsapp = 'Nomor WhatsApp wajib diisi.'
    else if (!validWa(d.whatsapp)) er.whatsapp = 'Nomor tidak valid. Contoh: 08123456789 atau 628123456789.'
    else if (rows.some(r => r.id !== edit && waNumber(r.whatsapp) === d.whatsapp)) er.whatsapp = 'Nomor WhatsApp ini sudah terdaftar.'
    if (d.email && !validEmail(d.email)) er.email = 'Format email tidak valid (contoh: nama@gmail.com), atau kosongkan.'
    setFe(er); if (Object.keys(er).length) return
    try { if (edit) { const lama = rows.find(r => r.id === edit); await updateDoc(doc(db,'participants',edit), d)
        try { await syncTiket(edit, d, lama) } catch (ex2) { setErr('Data peserta tersimpan, tetapi tiketnya gagal diperbarui (' + (ex2.code || ex2.message) + '). Simpan ulang data peserta ini untuk mencoba lagi.') } }
      else await addDoc(collection(db,'participants'), { ...d, createdAt: serverTimestamp() })
      setF(empty); setEdit(null) } catch (ex) { setErr(ex.code === 'permission-denied' ? 'Ditolak oleh aturan Firestore (permission-denied). Periksa dokumen akun di koleksi users (role dan active) dan pastikan firestore.rules sudah di-Publish.' : 'Gagal menyimpan: ' + (ex.code || '') + ' ' + ex.message) } }
  // Hapus peserta sekaligus mencabut tiketnya (satu batch), agar tidak ada tiket aktif tanpa pemilik
  const hapus = async (r) => {
    if (!await ask({ title:'Hapus peserta?', text:`${r.name} akan dihapus dari daftar dan tiketnya otomatis dicabut. Riwayat check-in yang sudah ada tetap tersimpan.`, ok:'Hapus', danger:true })) return
    try { const s = await getDocs(query(collection(db,'tickets'), where('participantId','==',r.id))), b = writeBatch(db)
      s.docs.forEach(t => { if (t.data().status !== 'dicabut') b.update(t.ref, { status: 'dicabut' }) })
      b.delete(doc(db,'participants',r.id)); await b.commit()
      addDoc(collection(db,'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'hapus peserta', participant: r.name }).catch(() => {})
    } catch (ex) { setErr('Gagal menghapus peserta: ' + (ex.code || '') + ' ' + ex.message) } }
  const exp = () => { const ws = XLSX.utils.json_to_sheet(rows.map(r => ({ ID:r.id, Nama:r.name, Email:r.email, WhatsApp:r.whatsapp, Instansi:r.institution, Status:r.status, Terdaftar:fmt(r.createdAt) })))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Peserta'); XLSX.writeFile(wb, 'peserta.xlsx') }
  const list = rows.filter(r => (r.name+' '+r.email+' '+r.institution+' '+r.whatsapp).toLowerCase().includes(q.trim().toLowerCase()))
  return <><div className="d-flex gap-2 mb-3 flex-wrap"><h1 className="h4 me-auto">Peserta ({loading ? <Skel w="2rem" h="1rem" className="align-middle"/> : rows.length})</h1>
    <Link className="btn btn-outline-primary btn-sm" to="/admin/participants/import">Import Excel</Link>
    <button className="btn btn-outline-secondary btn-sm" onClick={exp}>Export Excel</button></div>
    {err && <div className="alert alert-danger">{err}</div>}
    <div className="panel"><form className="row g-2" onSubmit={save}>
      {[['name','Nama lengkap *'],['whatsapp','WhatsApp * (08… atau 628…)'],['email','Email (opsional)'],['institution','Asal instansi (opsional)']].map(([k,p]) =>
        <div className="col-md" key={k}><input className={'form-control' + (fe[k] ? ' is-invalid' : '')} placeholder={p} value={f[k]} type={k==='whatsapp' ? 'tel' : 'text'} inputMode={k==='whatsapp' ? 'numeric' : undefined} onChange={e=>{setF({...f,[k]:e.target.value}); if (fe[k]) setFe({...fe,[k]:''})}}/>
          {fe[k] && <div className="invalid-feedback">{fe[k]}</div>}</div>)}
      <div className="col-auto d-flex gap-2"><button className="btn btn-primary">{edit ? 'Simpan perubahan' : 'Tambah peserta'}</button>{edit && <button type="button" className="btn btn-outline-secondary" onClick={() => { setEdit(null); setF(empty); setFe({}) }}>Batal</button>}</div></form></div>
    <input className="form-control mb-2" placeholder="Cari nama, email, instansi, atau nomor WhatsApp (hasil langsung muncul)" type="search" autoComplete="off" value={q} onChange={e=>setQ(e.target.value)}/>
    <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Nama</th><th>Email</th><th>WhatsApp</th><th>Instansi</th><th>Status</th><th/></tr></thead><tbody>
      {loading && <SkelRows rows={6} cols={6}/>}
      {!loading && list.map(r => <tr key={r.id}><td>{r.name}</td><td>{r.email}</td><td>{r.whatsapp}</td><td>{r.institution}</td><td><Badge s={r.status}/></td>
        <td className="text-end"><button className="btn btn-link btn-sm" onClick={()=>{setEdit(r.id);setFe({});setF({name:r.name,email:r.email||'',whatsapp:r.whatsapp||'',institution:r.institution||'',status:r.status||'terdaftar'})}}>Ubah</button>
        <button className="btn btn-link btn-sm text-danger" onClick={() => hapus(r)}>Hapus</button></td></tr>)}
      {!loading && !list.length && <tr><td colSpan="6" className="text-center text-muted py-4">{rows.length ? 'Tidak ada peserta yang cocok.' : 'Belum ada peserta. Tambahkan manual atau import Excel.'}</td></tr>}</tbody></table></div></>
}
