import { useEffect, useState } from 'react'; import { doc, getDoc, setDoc } from 'firebase/firestore'; import { db } from '../firebase'
export default function Seminar() {
  const [f, setF] = useState({ title:'', date:'', time:'', location:'', description:'' }), [msg, setMsg] = useState('')
  useEffect(() => { getDoc(doc(db,'seminar','main')).then(s => s.exists() && setF(s.data())) }, [])
  const save = async (e) => { e.preventDefault(); try { await setDoc(doc(db,'seminar','main'), f); setMsg('Informasi seminar disimpan.') } catch { setMsg('Gagal menyimpan. Periksa koneksi atau hak akses akun Anda.') } }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return <><h1 className="h4">Informasi seminar</h1><p className="sub">Data ini tampil di halaman tiket yang dibuka peserta.</p>
    {msg && <div className="alert alert-success">{msg}</div>}
    <form onSubmit={save} className="panel fgrid">
      <div className="s6"><label className="form-label">Judul seminar</label><input className="form-control" value={f.title} onChange={set('title')}/></div>
      <div className="s2"><label className="form-label">Tanggal</label><input className="form-control" type="date" value={f.date} onChange={set('date')}/></div>
      <div className="s2"><label className="form-label">Waktu</label><input className="form-control" type="time" value={f.time} onChange={set('time')}/></div>
      <div className="s2"><label className="form-label">Lokasi</label><input className="form-control" value={f.location} onChange={set('location')}/></div>
      <div className="s6"><label className="form-label">Deskripsi</label><textarea className="form-control" rows="3" value={f.description} onChange={set('description')}/></div>
      <div className="s6"><button className="btn btn-primary">Simpan</button></div></form></>
}
