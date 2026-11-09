import { useEffect, useRef, useState } from 'react'; import { Html5Qrcode } from 'html5-qrcode'
import { addDoc, collection, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'; import { ResultModal } from '../ui'
export default function Scanner() {
  const lock = useRef(false), [res, setRes] = useState(null), [pending, setPending] = useState(null), [camErr, setCamErr] = useState('')
  const [rep, setRep] = useState(false), [repName, setRepName] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { const s = new Html5Qrcode('reader')
    s.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, async (token) => {
      if (lock.current) return; lock.current = true
      try { const id = String(token).replace(/\//g, ''), t = await getDoc(doc(db, 'tickets', id))
        if (!t.exists()) throw new Error('QR ini bukan tiket seminar yang terdaftar.')
        if (t.data().status === 'dicabut') throw new Error(`Tiket atas nama ${t.data().participantName} sudah dicabut.`)
        if (t.data().status === 'terpakai') throw new Error(`Tiket atas nama ${t.data().participantName} sudah pernah digunakan.`)
        setPending({ token: id, participantName: t.data().participantName, institution: t.data().institution })
      } catch (e) { setRes({ ok: false, title: 'Tiket tidak valid', text: e.message }) } })
      .catch(() => setCamErr('Kamera tidak dapat dibuka. Izinkan akses kamera di browser, lalu muat ulang halaman.'))
    return () => { s.isScanning && s.stop().catch(() => {}) } }, [])
  const close = () => { setRes(null); lock.current = false }
  const cancel = () => { setPending(null); setRep(false); setRepName(''); lock.current = false }
  const confirmIn = async () => { const name = rep ? repName.trim() : ''; setBusy(true)
    try { const ref = doc(db, 'tickets', pending.token), cref = doc(collection(db, 'checkins'))
      await runTransaction(db, async (tx) => { const t = await tx.get(ref)
        if (!t.exists()) throw new Error('Tiket tidak dikenal.'); if (t.data().status === 'dicabut') throw new Error('Tiket sudah dicabut.'); if (t.data().status !== 'aktif') throw new Error('Tiket sudah digunakan perangkat lain.')
        tx.update(ref, { status: 'terpakai', usedAt: serverTimestamp(), usedBy: auth.currentUser.email })
        tx.set(cref, { participantId: t.data().participantId, participantName: t.data().participantName, ticketId: pending.token, isRepresentative: !!name, representativeName: name || null, officerEmail: auth.currentUser.email, checkedInAt: serverTimestamp() }) })
      addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'check-in', participant: pending.participantName, representative: name || null })
      setRes({ ok: true, title: 'Check-in berhasil', text: `${pending.participantName}${name ? `, diwakili oleh ${name}` : ''}` })
    } catch (e) { setRes({ ok: false, title: 'Check-in gagal', text: e.message }) }
    setPending(null); setRep(false); setRepName(''); setBusy(false) }
  return <><h1 className="h4">Scan dan check-in</h1><p className="sub">Arahkan kamera ke QR pada tiket peserta.</p>
    <div className="scan"><div>{camErr && <div className="alert alert-danger">{camErr}</div>}<div id="reader"/></div>
    <div>{pending ? <div className="panel"><div className="fw-semibold fs-5">{pending.participantName}</div><div className="text-muted mb-3">{pending.institution || 'Tanpa instansi'}</div>
      <div className="form-check mb-3"><input id="rep" type="checkbox" className="form-check-input" checked={rep} onChange={e => setRep(e.target.checked)}/><label htmlFor="rep" className="form-check-label">Hadir melalui perwakilan</label></div>
      {rep && <input className="form-control mb-3" placeholder="Nama perwakilan (wajib)" value={repName} onChange={e => setRepName(e.target.value)}/>}
      <div className="d-flex gap-2"><button className="btn btn-primary flex-fill" disabled={busy || (rep && !repName.trim())} onClick={confirmIn}>{busy ? 'Memproses…' : 'Check-in'}</button>
        <button className="btn btn-outline-secondary" disabled={busy} onClick={cancel}>Batal</button></div></div>
      : <div className="panel text-center text-muted py-4"><i className="bi bi-upc-scan fs-1 d-block mb-2"/>Menunggu QR tiket…<div className="small">Data peserta akan muncul di sini.</div></div>}</div></div>
    {res && <ResultModal {...res} onClose={close}/>}</>
}
