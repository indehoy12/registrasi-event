import BersihData from './BersihData'
import { useEffect, useState } from 'react'; import { initializeApp, deleteApp } from 'firebase/app'; import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'; import { doc, setDoc, updateDoc } from 'firebase/firestore'; import { auth, db, firebaseConfig } from '../firebase'; import { useColState, fmt } from '../hooks'; import { SkelRows, SkelList } from '../ui'
const empty = { email: '', password: '', role: 'petugas' }
const ROLE = { petugas: 'Petugas Registrasi', admin: 'Admin/Panitia', superadmin: 'Super Admin' }
// Pesan galat Firebase yang mudah dipahami
const galat = (er) => ({
  'auth/email-already-in-use': 'Email ini sudah terdaftar sebagai akun. Gunakan email lain.',
  'auth/invalid-email': 'Format email tidak valid.',
  'auth/weak-password': 'Kata sandi terlalu lemah. Gunakan minimal 8 karakter.',
  'auth/network-request-failed': 'Koneksi internet bermasalah. Coba lagi.',
  'auth/operation-not-allowed': 'Login email/kata sandi belum diaktifkan di Firebase.'
}[er.code] || er.message)
// Satu kolom form: label di atas, ikon, dan petunjuk singkat (gaya sama dengan form Tambah peserta)
const Field = ({ id, label, req, icon, hint, error, children }) => <div>
  <label className="form-label pf-label" htmlFor={id}>{label}{req && <span className="pf-req" title="Wajib diisi"> *</span>}</label>
  <div className={'pf-input' + (error ? ' has-err' : '')}><i className={'bi bi-' + icon} aria-hidden="true"/>{children}</div>
  {error ? <div className="pf-err" role="alert"><i className="bi bi-exclamation-circle"/> {error}</div> : hint && <div className="pf-hint">{hint}</div>}</div>
export default function Settings() {
  const [users, lu] = useColState('users'), [logs, ll] = useColState('auditLogs', 'at')
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [f, setF] = useState(empty), [err, setErr] = useState(''), [ok, setOk] = useState(''), [lihat, setLihat] = useState(false)
  const bukaTambah = () => { setF(empty); setErr(''); setOk(''); setLihat(false); setOpen(true) }
  const tutup = () => { if (busy) return; setOpen(false); setF(empty); setErr(''); setOk('') }
  useEffect(() => { if (!open) return; const k = (e) => e.key === 'Escape' && tutup(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) })
  const save = async (e, lagi = false) => { e?.preventDefault?.(); if (busy) return; setErr(''); setOk('')
    const email = f.email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Format email tidak valid.')
    if (f.password.length < 8) return setErr('Kata sandi minimal 8 karakter.')
    if (users.some(u => (u.email || '').toLowerCase() === email)) return setErr('Email ini sudah terdaftar sebagai akun. Gunakan email lain.')
    setBusy(true); let sec
    try { sec = initializeApp(firebaseConfig, 'sec' + Date.now()); const a = getAuth(sec)
      const c = await createUserWithEmailAndPassword(a, email, f.password)
      await setDoc(doc(db, 'users', c.user.uid), { email, role: f.role, active: true })
      await signOut(a)
      if (lagi) { setF({ ...empty, role: f.role }); setOk('Akun ' + email + ' berhasil dibuat. Silakan tambah akun berikutnya.') }
      else { setOpen(false); setF(empty); setMsg('Akun ' + email + ' berhasil dibuat.') }
    } catch (er) { setErr('Gagal membuat akun: ' + galat(er)) }
    if (sec) deleteApp(sec); setBusy(false) }
  const [msg, setMsg] = useState('')
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 6000); return () => clearTimeout(t) }, [msg])
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return <><div className="d-flex gap-2 mb-3 flex-wrap"><h1 className="h4 me-auto">Pengaturan akun</h1>
    <button className="btn btn-primary btn-sm" onClick={bukaTambah}><i className="bi bi-plus-lg"/> Tambah akun</button></div>
    {msg && <div className="alert alert-success py-2" role="status"><i className="bi bi-check-circle-fill"/> {msg}</div>}
    <div className="table-responsive"><table className="table table-sm mb-4"><tbody>{lu && <SkelRows rows={3} cols={4}/>}{!lu && users.map(u => <tr key={u.id}><td>{u.email}{u.id === auth.currentUser?.uid && <small className="text-muted"> (Anda)</small>}</td><td>{ROLE[u.role] || u.role}</td><td>{u.active === false ? 'nonaktif' : 'aktif'}</td><td className="text-end"><button className="btn btn-link btn-sm" disabled={u.id === auth.currentUser?.uid && u.active !== false} title={u.id === auth.currentUser?.uid && u.active !== false ? 'Akun yang sedang dipakai tidak bisa dinonaktifkan' : undefined} onClick={() => updateDoc(doc(db, 'users', u.id), { active: u.active === false })}>{u.active === false ? 'Aktifkan' : 'Nonaktifkan'}</button></td></tr>)}</tbody></table></div>
    <h2 className="h5">Audit log</h2>{ll && <SkelList rows={4}/>}<ul className="list-unstyled small">{logs.slice(0, 50).map(l => <li key={l.id}>{fmt(l.at)}: {l.actor}, {l.action}</li>)}</ul><BersihData/>
    {open && <div className="mdl-back" onMouseDown={e => e.target === e.currentTarget && tutup()}>
      <form className="mdl mdl-form" role="dialog" aria-modal="true" aria-labelledby="ak-t" onSubmit={save} noValidate>
        <div className="pf-head"><div className="pf-ic"><i className="bi bi-person-plus"/></div>
          <div className="me-auto"><h2 id="ak-t" className="h5 mb-0">Tambah akun</h2></div>
          <button type="button" className="btn-close" aria-label="Tutup" onClick={tutup}/></div>
        <div className="pf-body">
          {err && <div className="alert alert-danger py-2 small mb-3" role="alert">{err}</div>}
          {ok && <div className="alert alert-success py-2 small mb-3" role="status"><i className="bi bi-check-circle-fill"/> {ok}</div>}
          <div className="pf-sec">Data akun</div>
          <div className="row g-3">
            <div className="col-12"><Field id="ak-email" label="Email" req icon="envelope" hint="Email baru, bukan email yang sedang Anda pakai.">
              <input id="ak-email" className="form-control" type="email" inputMode="email" placeholder="nama@perusahaan.co.id" autoComplete="off" autoFocus disabled={busy} value={f.email} onChange={e => set('email', e.target.value)}/></Field></div>
            <div className="col-12"><Field id="ak-pass" label="Kata sandi" req icon="key" hint="Minimal 8 karakter.">
              <input id="ak-pass" className="form-control" type={lihat ? 'text' : 'password'} placeholder="Kata sandi" autoComplete="new-password" disabled={busy} value={f.password} onChange={e => set('password', e.target.value)}/>
              <button type="button" className="btn btn-link p-0 pf-eye" tabIndex={-1} aria-label={lihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} onClick={() => setLihat(v => !v)}><i className={'bi bi-eye' + (lihat ? '-slash' : '')}/></button></Field></div>
            <div className="col-12"><Field id="ak-role" label="Peran" req icon="shield-check">
              <select id="ak-role" className="form-select" disabled={busy} value={f.role} onChange={e => set('role', e.target.value)}>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field></div>
          </div>
        </div>
        <div className="pf-foot">
          <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={tutup}>Batal</button>
          <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => save(null, true)}><i className="bi bi-plus-lg"/> Simpan &amp; tambah lagi</button>
          <button className={'btn btn-primary' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={busy}>Simpan akun</button></div>
      </form></div>}</>
}
