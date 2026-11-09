import { useState } from 'react'; import { signInWithEmailAndPassword } from 'firebase/auth'; import { auth } from '../firebase'
export default function Login({ noAccess }) {
  const [e, setE] = useState(''), [p, setP] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const go = async (ev) => { ev.preventDefault(); setErr(''); setBusy(true)
    try { await signInWithEmailAndPassword(auth, e, p) } catch { setErr('Email atau kata sandi salah.') } setBusy(false) }
  return <div className="login"><div className="login-card">
    <div className="brand-mark"><i className="bi bi-qr-code-scan"/></div>
    <h1 className="h4">Masuk ke panel seminar</h1><p className="sub">Gunakan akun yang diberikan oleh Super Admin.</p>
    {noAccess && <div className="alert alert-warning">Akun Anda belum diberi akses. Hubungi Super Admin.</div>}
    {err && <div className="alert alert-danger">{err}</div>}
    <form onSubmit={go}>
      <label className="form-label" htmlFor="em">Email</label><input id="em" className="form-control mb-3" type="email" autoComplete="username" value={e} onChange={x => setE(x.target.value)} required/>
      <label className="form-label" htmlFor="pw">Kata sandi</label><input id="pw" className="form-control mb-4" type="password" autoComplete="current-password" value={p} onChange={x => setP(x.target.value)} required/>
      <button className="btn btn-primary w-100" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button></form></div></div>
}
