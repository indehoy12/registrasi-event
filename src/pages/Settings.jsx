import { useState } from 'react'; import { initializeApp, deleteApp } from 'firebase/app'; import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'; import { doc, setDoc, updateDoc } from 'firebase/firestore'; import { db, firebaseConfig } from '../firebase'; import { useColState, fmt } from '../hooks'; import { SkelRows, SkelList } from '../ui'
export default function Settings() {
  const [users, lu] = useColState('users'), [logs, ll] = useColState('auditLogs', 'at'), [f, setF] = useState({ email:'', password:'', role:'petugas' }), [msg, setMsg] = useState('')
  const add = async (e) => { e.preventDefault(); setMsg(''); let sec
    try { sec = initializeApp(firebaseConfig, 'sec' + Date.now()); const a = getAuth(sec)
      const c = await createUserWithEmailAndPassword(a, f.email, f.password)
      await setDoc(doc(db, 'users', c.user.uid), { email: f.email, role: f.role, active: true })
      await signOut(a); setMsg('Akun dibuat.'); setF({ email:'', password:'', role:'petugas' }) } catch (er) { setMsg('Gagal membuat akun: ' + er.message) }
    if (sec) deleteApp(sec) }
  return <><h1 className="h4 mb-3">Pengaturan akun</h1>{msg && <div className="alert alert-info">{msg}</div>}
    <form className="row g-2 mb-4" onSubmit={add}><div className="col-md"><input className="form-control" type="email" placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required/></div>
      <div className="col-md"><input className="form-control" type="password" minLength="8" placeholder="Kata sandi (min. 8)" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required/></div>
      <div className="col-md-2"><select className="form-select" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="petugas">Petugas Registrasi</option><option value="admin">Admin/Panitia</option><option value="superadmin">Super Admin</option></select></div>
      <div className="col-auto"><button className="btn btn-primary">Tambah akun</button></div></form>
    <div className="table-responsive"><table className="table table-sm mb-4"><tbody>{lu && <SkelRows rows={3} cols={4}/>}{!lu && users.map(u => <tr key={u.id}><td>{u.email}</td><td>{u.role}</td><td>{u.active === false ? 'nonaktif' : 'aktif'}</td><td className="text-end"><button className="btn btn-link btn-sm" onClick={() => updateDoc(doc(db, 'users', u.id), { active: u.active === false })}>{u.active === false ? 'Aktifkan' : 'Nonaktifkan'}</button></td></tr>)}</tbody></table></div>
    <h2 className="h5">Audit log</h2>{ll && <SkelList rows={4}/>}<ul className="list-unstyled small">{logs.slice(0, 50).map(l => <li key={l.id}>{fmt(l.at)}: {l.actor}, {l.action}</li>)}</ul></>
}
