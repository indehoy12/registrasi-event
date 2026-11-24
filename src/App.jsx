import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { Skel } from './ui'
import { useSeminar, resetData } from './hooks'
import Login from './pages/Login'

// Setiap menu dimuat saat dibuka (bukan semuanya di awal), jadi halaman pertama jauh lebih ringan. Skeleton tampil selama menu dimuat.
const Dashboard = lazy(() => import('./pages/Dashboard')), Seminar = lazy(() => import('./pages/Seminar')), Participants = lazy(() => import('./pages/Participants')),
  Import = lazy(() => import('./pages/Import')), Tickets = lazy(() => import('./pages/Tickets')), Distribution = lazy(() => import('./pages/Distribution')),
  Scanner = lazy(() => import('./pages/Scanner')), Checkins = lazy(() => import('./pages/Checkins')), Reports = lazy(() => import('./pages/Reports')),
  Settings = lazy(() => import('./pages/Settings')), PublicTicket = lazy(() => import('./pages/PublicTicket'))
const Muat = () => <div className="p-4 fit" style={{ maxWidth: 720, margin: '0 auto' }} aria-busy="true" aria-label="Memuat"><Skel w="40%" h="1.6rem" className="mb-3"/><Skel h="5rem" r="14px" className="mb-3"/><Skel h="12rem" r="14px"/></div>
// Setelah masuk, menu lain dimuat diam-diam saat browser sedang senggang, supaya berpindah menu terasa instan.
const PRA = { dashboard: () => import('./pages/Dashboard'), participants: () => import('./pages/Participants'), tickets: () => import('./pages/Tickets'), distribution: () => import('./pages/Distribution'), checkins: () => import('./pages/Checkins'), reports: () => import('./pages/Reports'), seminar: () => import('./pages/Seminar') }
const AD = ['superadmin','admin'], ALL = ['superadmin','admin','petugas']
const GROUPS = [
  ['', [['dashboard','Dashboard','speedometer2',ALL]]],
  ['Persiapan', [['seminar','Info acara','calendar-event',AD],['participants','Peserta','people',ALL],['tickets','Undangan QR','ticket-perforated',ALL],['distribution','Kirim undangan','whatsapp',AD]]],
  ['Hari pelaksanaan', [['scanner','Scan dan check-in','qr-code-scan',ALL],['checkins','Riwayat kehadiran','clock-history',ALL]]],
  ['Kelola', [['reports','Laporan','file-earmark-bar-graph',AD],['settings','Akun dan log','gear',['superadmin']]]],
]
const ROLE = { superadmin: 'Super Admin', admin: 'Panitia', petugas: 'Petugas registrasi' }
// Nama di pojok kiri mengikuti judul acara yang diisi di Info acara
const Judul = () => { const { sem } = useSeminar(); return <>{sem.title || 'Registrasi'}</> }
export default function App() {
  const [open, setOpen] = useState(false), [user, setUser] = useState(undefined), [role, setRole] = useState(null), nav = useNavigate()
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { resetData(); setUser(null); setRole(null); return }
    const s = await getDoc(doc(db, 'users', u.uid))
    setRole(s.exists() && s.data().active === true ? s.data().role : null); setUser(u)
  }), [])
  useEffect(() => { if (!role) return; const t = setTimeout(() => Object.values(PRA).forEach(f => f().catch(() => {})), 2500); return () => clearTimeout(t) }, [role])
  if (user === undefined) return <div className="p-4" style={{ maxWidth: 720, margin: '0 auto' }} aria-busy="true" aria-label="Memuat"><Skel w="40%" h="1.6rem" className="mb-3"/><Skel h="5rem" r="14px" className="mb-3"/><Skel h="12rem" r="14px"/></div>
  if (!user || !role) return <Suspense fallback={<Muat/>}><Routes><Route path="/undangan/:token" element={<PublicTicket/>}/><Route path="/tiket/:token" element={<PublicTicket/>}/><Route path="/admin/login" element={<Login noAccess={!!user && !role}/>}/><Route path="*" element={<Navigate to="/admin/login"/>}/></Routes></Suspense>
  const home = role === 'petugas' ? '/admin/scanner' : '/admin/dashboard', P = (roles, el) => roles.includes(role) ? el : <Navigate to={home}/>
  return (<Suspense fallback={<Muat/>}><Routes>
    <Route path="/undangan/:token" element={<PublicTicket/>}/><Route path="/tiket/:token" element={<PublicTicket/>}/>
    <Route path="*" element={
      <div className="shell">
        <div className={`backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)}/>
        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <div className="brand"><div className="brand-mark"><i className="bi bi-qr-code-scan"/></div><div><b className="brand-t"><Judul/></b><small>Registrasi peserta</small></div></div>
          <nav className="menu">
            {GROUPS.map(([label, items]) => { const vis = items.filter(i => i[3].includes(role)); return vis.length ? <div key={label}>
              {label && <div className="menu-label">{label}</div>}
              {vis.map(([p, l, ic]) => <NavLink key={p} to={`/admin/${p}`} onClick={() => setOpen(false)}><i className={`bi bi-${ic}`}/>{l}</NavLink>)}</div> : null })}
          </nav>
          <div className="me"><div className="av">{(user.email || '?')[0].toUpperCase()}</div>
            <div className="nm"><div>{user.email}</div><small>{ROLE[role]}</small></div>
            <button className="btn btn-outline-secondary btn-sm" title="Keluar" aria-label="Keluar" onClick={async () => { await signOut(auth); resetData(); nav('/admin/login') }}><i className="bi bi-box-arrow-right"/></button></div>
        </aside>
        <div className="main">
          <div className="topbar"><button aria-label="Buka menu" onClick={() => setOpen(true)}><i className="bi bi-list"/></button><b className="brand-t"><Judul/></b></div>
          <main className="content"><Suspense fallback={<Muat/>}><Routes>
            <Route path="/admin/login" element={<Navigate to={home}/>}/>
            <Route path="/admin/dashboard" element={P(ALL, <Dashboard/>)}/>
            <Route path="/admin/seminar" element={P(AD, <Seminar/>)}/>
            <Route path="/admin/participants" element={P(ALL, <Participants readOnly={!AD.includes(role)}/>)}/>
            <Route path="/admin/participants/import" element={P(AD, <Import/>)}/>
            <Route path="/admin/tickets" element={P(ALL, <Tickets readOnly={!AD.includes(role)}/>)}/>
            <Route path="/admin/distribution" element={P(AD, <Distribution/>)}/>
            <Route path="/admin/scanner" element={P(ALL, <Scanner/>)}/>
            <Route path="/admin/checkins" element={P(ALL, <Checkins canEdit={AD.includes(role)}/>)}/>
            <Route path="/admin/reports" element={P(AD, <Reports/>)}/>
            <Route path="/admin/settings" element={P(['superadmin'], <Settings/>)}/>
            <Route path="*" element={<Navigate to={home}/>}/>
          </Routes></Suspense></main>
        </div>
      </div>}/>
  </Routes></Suspense>)
}
