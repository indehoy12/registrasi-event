import { Link } from 'react-router-dom'
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
// Bunyi singkat (tanpa file audio): ok = bip tinggi, warn = dua bip sedang, bad = nada rendah panjang
let ac
export function beep(kind) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume?.()
    const seq = kind === 'ok' ? [[880, 0, .14]] : kind === 'warn' ? [[660, 0, .12], [660, .18, .12]] : [[220, 0, .45]]
    seq.forEach(([f, t, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; o.type = kind === 'bad' ? 'sawtooth' : 'sine'
      g.gain.setValueAtTime(.18, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + t + d)
      o.connect(g); g.connect(ac.destination); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + d) })
  } catch {}
}
// Modal hasil scan dengan animasi centang hijau / silang merah (warn = kuning, untuk tiket yang sudah dipakai)
export function ResultModal({ ok, warn, title, text, onClose }) {
  useEffect(() => { navigator.vibrate?.(ok ? 80 : [120, 60, 120]); beep(ok ? 'ok' : warn ? 'warn' : 'bad'); if (!ok) return; const t = setTimeout(onClose, 2600); return () => clearTimeout(t) }, [])
  return <div className="mdl-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="mdl text-center" role="alertdialog" aria-modal="true" aria-labelledby="rm-t">
      <svg className={`ai ${ok ? 'ok' : warn ? 'warn' : 'bad'}`} viewBox="0 0 52 52" aria-hidden="true">
        <circle className="ai-c" cx="26" cy="26" r="24" fill="none" pathLength="1"/>
        {ok ? <path className="ai-m" fill="none" d="M15 27l8 8 15-17" pathLength="1"/>
            : warn ? <><path className="ai-m" fill="none" d="M26 14v16" pathLength="1"/><path className="ai-m ai-m2" fill="none" d="M26 37v.5" pathLength="1"/></>
            : <><path className="ai-m" fill="none" d="M17 17l18 18" pathLength="1"/><path className="ai-m ai-m2" fill="none" d="M35 17L17 35" pathLength="1"/></>}
      </svg>
      <h2 id="rm-t" className={`h5 mb-1 ${warn ? 'text-warning-emphasis' : ''}`}>{title}</h2><p className="text-muted mb-4">{text}</p>
      <button className={`btn ${ok ? 'btn-primary' : warn ? 'btn-warning' : 'btn-danger'} w-100 btn-lg`} autoFocus onClick={onClose}>{ok ? 'Lanjut scan' : 'Tutup dan scan lagi'}</button>
    </div></div>
}

// Popup check-in berhasil: centang hijau, data peserta, tombol "Diwakilkan?" untuk menambah nama perwakilan
export function CheckinModal({ name, institution, code, onRep, onUndo, onClose }) {
  const [edit, setEdit] = useState(false), [rep, setRep] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(''), [err, setErr] = useState(''), [undoing, setUndoing] = useState(false)
  useEffect(() => { navigator.vibrate?.(80); beep('ok') }, [])
  // Tertutup otomatis, kecuali petugas sedang mengetik nama perwakilan
  useEffect(() => { if (edit && !saved) return; const t = setTimeout(onClose, saved ? 2000 : 6000); return () => clearTimeout(t) }, [edit, saved])
  const undo = async () => {
    if (undoing) return; setUndoing(true); setErr('')
    try { await onUndo() } catch { setErr('Gagal membatalkan. Periksa koneksi atau hubungi admin.'); setUndoing(false) }
  }
  const save = async (e) => {
    e.preventDefault(); const n = rep.trim(); if (!n || busy) return
    setBusy(true); setErr('')
    try { await onRep(n); setSaved(n); setEdit(false) } catch { setErr('Gagal menyimpan. Periksa koneksi lalu coba lagi.') }
    setBusy(false)
  }
  return <div className="mdl-back" onMouseDown={e => e.target === e.currentTarget && !edit && onClose()}>
    <div className="mdl text-center" role="alertdialog" aria-modal="true" aria-labelledby="ck-t">
      <svg className="ai ok" viewBox="0 0 52 52" aria-hidden="true"><circle className="ai-c" cx="26" cy="26" r="24" fill="none" pathLength="1"/><path className="ai-m" fill="none" d="M15 27l8 8 15-17" pathLength="1"/></svg>
      <h2 id="ck-t" className="h5 mb-1 text-success">Check-in berhasil</h2>
      <div className="fw-bold fs-4 lh-sm">{name}</div>
      <div className="text-muted">{institution || 'Tanpa instansi'}</div>
      <div className="code-chip my-2">No. {code}</div>
      {saved && <div className="ck-rep"><i className="bi bi-person-badge"/> Diwakili oleh <b>{saved}</b></div>}
      {edit && !saved && <form onSubmit={save} className="text-start mt-2">
        <label htmlFor="wakil" className="form-label mb-1">Nama perwakilan</label>
        <input id="wakil" className="form-control form-control-lg" placeholder="Nama orang yang hadir" value={rep} autoFocus autoComplete="off" onChange={e => setRep(e.target.value)}/>
        {err && <div className="text-danger small mt-1">{err}</div>}
        <div className="d-flex gap-2 mt-3">
          <button className={'btn btn-primary btn-lg flex-fill' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={!rep.trim() || busy}>Simpan</button>
          <button type="button" className="btn btn-outline-secondary btn-lg" disabled={busy} onClick={() => setEdit(false)}>Batal</button></div>
      </form>}
      {!edit && <div className="d-grid gap-2 mt-3">
        <button className="btn btn-success btn-lg" autoFocus onClick={onClose}>{saved ? 'Selesai' : 'OK, lanjut scan'}</button>
        {!saved && <button className="btn btn-outline-secondary" onClick={() => setEdit(true)}><i className="bi bi-person-badge"/> Diwakilkan?</button>}
        <button className={'btn btn-link text-danger btn-sm' + (undoing ? ' is-busy' : '')} aria-busy={undoing} disabled={undoing} onClick={undo}><i className="bi bi-arrow-counterclockwise"/> Salah scan? Batalkan</button>
        {err && <div className="text-danger small">{err}</div>}
      </div>}
      {!edit && !saved && <div className="ck-bar" aria-hidden="true"/>}
    </div></div>
}

// Skeleton pengganti tulisan "Memuat…"
export const Skel = ({ w = '100%', h = '1rem', r, className = '' }) => <span className={`skel ${className}`} style={{ width: w, height: h, borderRadius: r }} aria-hidden="true"/>
export const SkelRows = ({ rows = 5, cols = 4 }) => Array.from({ length: rows }, (_, i) => <tr key={i} aria-hidden="true">{Array.from({ length: cols }, (_, j) => <td key={j}><Skel w={j === 0 ? '70%' : '55%'}/></td>)}</tr>)
export const SkelList = ({ rows = 3 }) => <div aria-busy="true" aria-label="Memuat data">{Array.from({ length: rows }, (_, i) => <div className="recent" key={i}><div style={{ flex: 1 }}><Skel w="60%" className="mb-1"/><Skel w="30%" h=".7rem"/></div><Skel w="3rem" h=".7rem"/></div>)}</div>

// Peringatan bila titik lokasi Maps belum diisi (muncul di Dashboard, Tiket, dan Distribusi)
export const MapsWarn = ({ loaded, mapsOk }) => loaded && !mapsOk ? <div className="alert alert-warning d-flex gap-2 align-items-start" role="alert"><i className="bi bi-geo-alt-fill fs-5"/>
  <div><b>Titik lokasi Google Maps belum diisi.</b> Pengiriman tiket lewat WhatsApp ditahan sampai lokasi diisi, supaya peserta tidak tersesat. <Link to="/admin/seminar">Isi sekarang</Link></div></div> : null
