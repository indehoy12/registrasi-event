import { useEffect, useRef, useState } from 'react'; import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'; import QRCode from 'qrcode'; import { db } from '../firebase'
export default function PublicTicket() {
  const { token } = useParams(), [t, setT] = useState(null), [sem, setSem] = useState({}), [img, setImg] = useState(''), [err, setErr] = useState(''), a = useRef()
  useEffect(() => { (async () => { try {
    const s = await getDoc(doc(db, 'tickets', token)); if (!s.exists()) return setErr('Tiket tidak ditemukan. Periksa kembali tautan Anda.')
    setT(s.data()); setImg(await QRCode.toDataURL(token, { width: 700, margin: 2 }))
    const m = await getDoc(doc(db, 'seminar', 'main')); if (m.exists()) setSem(m.data()) } catch { setErr('Tiket tidak dapat dimuat. Coba lagi.') } })() }, [token])
  return <div className="container py-4" style={{ maxWidth: 440 }}>
    {err && <div className="alert alert-danger">{err}</div>}
    {t && <div className="card-stat text-center">
      <h1 className="h5">{sem.title || 'Tiket Seminar'}</h1>
      <p className="text-muted mb-2">{[sem.date, sem.time, sem.location].filter(Boolean).join(', ')}</p>
      {t.status === 'dicabut' && <div className="alert alert-danger">Tiket ini sudah dicabut.</div>}
      {t.status === 'terpakai' && <div className="alert alert-warning">Tiket ini sudah digunakan.</div>}
      <img src={img} alt="QR tiket" className="img-fluid mb-2"/>
      <div className="fw-semibold">{t.participantName}</div><div className="text-muted mb-3">{t.institution}</div>
      <a ref={a} className="btn btn-primary" href={img} download={`tiket-${t.participantName}.png`}>Unduh tiket PNG</a>
      <p className="small text-muted mt-3 mb-0">Tunjukkan QR ini kepada petugas saat registrasi.</p></div>}
  </div>
}
