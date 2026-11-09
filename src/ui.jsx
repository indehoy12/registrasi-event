const MAP = { aktif:['success','Aktif'], terpakai:['secondary','Terpakai'], dicabut:['danger','Dicabut'], belum:['light','Belum dibuat'],
  terdaftar:['primary','Terdaftar'], perwakilan:['warning','Perwakilan'], peserta:['info','Peserta'] }
export const Badge = ({ s }) => { const [c, l] = MAP[s] || ['light', s]; return <span className={`badge rounded-pill text-bg-${c} fw-medium`}>{l}</span> }
export const Empty = ({ icon = 'inbox', text }) => <div className="empty"><i className={`bi bi-${icon}`}/><div>{text}</div></div>

import { createContext, useContext, useEffect, useState } from 'react'
const Ctx = createContext(() => Promise.resolve(false))
export const useDialog = () => useContext(Ctx)
// Pengganti confirm() bawaan browser: const ask = useDialog(); if (await ask({ title, text, ok, danger })) ...
export function DialogProvider({ children }) {
  const [d, setD] = useState(null)
  const ask = (o) => new Promise(res => setD({ ...o, res }))
  const done = (v) => { d.res(v); setD(null) }
  useEffect(() => { if (!d) return; const k = (e) => e.key === 'Escape' && done(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) })
  return <Ctx.Provider value={ask}>{children}{d &&
    <div className="mdl-back" onMouseDown={e => e.target === e.currentTarget && done(false)}>
      <div className="mdl" role="dialog" aria-modal="true" aria-labelledby="mdl-t">
        <div className={`mdl-ic ${d.danger ? 'danger' : 'warn'}`}><i className={`bi bi-${d.icon || (d.danger ? 'trash3' : 'question-lg')}`}/></div>
        <h2 id="mdl-t" className="h5 mb-2">{d.title}</h2><p className="text-muted mb-4">{d.text}</p>
        <div className="mdl-act"><button className="btn btn-outline-secondary" onClick={() => done(false)}>{d.cancel || 'Batal'}</button>
          <button className={`btn btn-${d.danger ? 'danger' : 'primary'}`} autoFocus onClick={() => done(true)}>{d.ok || 'Ya, lanjutkan'}</button></div>
      </div></div>}</Ctx.Provider>
}
// Modal hasil scan dengan animasi centang hijau / silang merah
export function ResultModal({ ok, title, text, onClose }) {
  useEffect(() => { navigator.vibrate?.(ok ? 80 : [120, 60, 120]); if (!ok) return; const t = setTimeout(onClose, 2600); return () => clearTimeout(t) }, [])
  return <div className="mdl-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="mdl text-center" role="alertdialog" aria-modal="true" aria-labelledby="rm-t">
      <svg className={`ai ${ok ? 'ok' : 'bad'}`} viewBox="0 0 52 52" aria-hidden="true">
        <circle className="ai-c" cx="26" cy="26" r="24" fill="none" pathLength="1"/>
        {ok ? <path className="ai-m" fill="none" d="M15 27l8 8 15-17" pathLength="1"/>
            : <><path className="ai-m" fill="none" d="M17 17l18 18" pathLength="1"/><path className="ai-m ai-m2" fill="none" d="M35 17L17 35" pathLength="1"/></>}
      </svg>
      <h2 id="rm-t" className="h5 mb-1">{title}</h2><p className="text-muted mb-4">{text}</p>
      <button className={`btn ${ok ? 'btn-primary' : 'btn-danger'} w-100`} autoFocus onClick={onClose}>{ok ? 'Lanjut scan' : 'Tutup dan scan lagi'}</button>
    </div></div>
}
