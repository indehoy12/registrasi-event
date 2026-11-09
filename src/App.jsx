import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Seminar from './pages/Seminar'
import Participants from './pages/Participants'
import Import from './pages/Import'
import Tickets from './pages/Tickets'
import Distribution from './pages/Distribution'
import Scanner from './pages/Scanner'
import Checkins from './pages/Checkins'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import PublicTicket from './pages/PublicTicket'

const AD = ['superadmin','admin'], ALL = ['superadmin','admin','petugas']
const GROUPS = [
  ['', [['dashboard','Dashboard','speedometer2',ALL]]],
  ['Persiapan', [['seminar','Info seminar','calendar-event',AD],['participants','Peserta','people',AD],['tickets','Tiket QR','ticket-perforated',AD],['distribution','Kirim tiket','whatsapp',AD]]],
  ['Hari pelaksanaan', [['scanner','Scan dan check-in','qr-code-scan',ALL],['checkins','Riwayat kehadiran','clock-history',ALL]]],
  ['Kelola', [['reports','Laporan','file-earmark-bar-graph',AD],['settings','Akun dan log','gear',['superadmin']]]],
]
const ROLE = { superadmin: 'Super Admin', admin: 'Panitia', petugas: 'Petugas registrasi' }
export default function App() {
  const [open, setOpen] = useState(false), [user, setUser] = useState(undefined), [role, setRole] = useState(null), nav = useNavigate()
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { setUser(null); setRole(null); return }
    const s = await getDoc(doc(db, 'users', u.uid))
    setRole(s.exists() && s.data().active !== false ? s.data().role : null); setUser(u)
  }), [])
  if (user === undefined) return <div className="p-5 text-center text-muted">Memuat…</div>
  if (!user || !role) return <Routes><Route path="/tiket/:token" element={<PublicTicket/>}/><Route path="/admin/login" element={<Login noAccess={!!user && !role}/>}/><Route path="*" element={<Navigate to="/admin/login"/>}/></Routes>
  const home = '/admin/dashboard', P = (roles, el) => roles.includes(role) ? el : <Navigate to={home}/>
  return (<Routes>
    <Route path="/tiket/:token" element={<PublicTicket/>}/>
    <Route path="*" element={
      <div className="shell">
        <div className={`backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)}/>
        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <div className="brand"><div className="brand-mark"><i className="bi bi-qr-code-scan"/></div><div><b>Seminar</b><small>Registrasi seminar</small></div></div>
          <nav className="menu">
            {GROUPS.map(([label, items]) => { const vis = items.filter(i => i[3].includes(role)); return vis.length ? <div key={label}>
              {label && <div className="menu-label">{label}</div>}
              {vis.map(([p, l, ic]) => <NavLink key={p} to={`/admin/${p}`} onClick={() => setOpen(false)}><i className={`bi bi-${ic}`}/>{l}</NavLink>)}</div> : null })}
          </nav>
          <div className="me"><div className="av">{(user.email || '?')[0].toUpperCase()}</div>
            <div className="nm"><div>{user.email}</div><small>{ROLE[role]}</small></div>
            <button className="btn btn-outline-secondary btn-sm" title="Keluar" aria-label="Keluar" onClick={async () => { await signOut(auth); nav('/admin/login') }}><i className="bi bi-box-arrow-right"/></button></div>
        </aside>
        <div className="main">
          <div className="topbar"><button aria-label="Buka menu" onClick={() => setOpen(true)}><i className="bi bi-list"/></button><b>Seminar</b></div>
          <main className="content"><Routes>
            <Route path="/admin/login" element={<Navigate to={home}/>}/>
            <Route path="/admin/dashboard" element={P(ALL, <Dashboard/>)}/>
            <Route path="/admin/seminar" element={P(AD, <Seminar/>)}/>
            <Route path="/admin/participants" element={P(AD, <Participants/>)}/>
            <Route path="/admin/participants/import" element={P(AD, <Import/>)}/>
            <Route path="/admin/tickets" element={P(AD, <Tickets/>)}/>
            <Route path="/admin/distribution" element={P(AD, <Distribution/>)}/>
            <Route path="/admin/scanner" element={P(ALL, <Scanner/>)}/>
            <Route path="/admin/checkins" element={P(ALL, <Checkins/>)}/>
            <Route path="/admin/reports" element={P(AD, <Reports/>)}/>
            <Route path="/admin/settings" element={P(['superadmin'], <Settings/>)}/>
            <Route path="*" element={<Navigate to={home}/>}/>
          </Routes></main>
        </div>
      </div>}/>
  </Routes>)
}
