import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { addDoc, collection, deleteField, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { ResultModal, CheckinModal, Skel, SkelList } from '../ui'
import { useColState, fmt, jam, showCode, ticketCode, normCode, parseTicketInput } from '../hooks'

export default function Scanner() {
  const lock = useRef(false), codeRef = useRef(null), ckRef = useRef([])
  const [mode, setMode] = useState('kamera')              // 'kamera' | 'manual'
  const [tickets, setTickets] = useState([]), [listErr, setListErr] = useState(false)
  const [res, setRes] = useState(null), [busy, setBusy] = useState(false), [note, setNote] = useState('')
  const [camErr, setCamErr] = useState(''), [camKey, setCamKey] = useState(0), [camReady, setCamReady] = useState(false)
  const [code, setCode] = useState(''), [manualErr, setManualErr] = useState('')
  const [checkins, loadCk] = useColState('checkins', 'checkedInAt'), [tkLoaded, setTkLoaded] = useState(false)

  // Daftar tiket (live) dipakai untuk pencarian nomor tiket dan penghitung kehadiran
  useEffect(() => onSnapshot(collection(db, 'tickets'),
    s => { setTickets(s.docs.map(d => ({ id: d.id, ...d.data() }))); setListErr(false); setTkLoaded(true) },
    e => { console.error('Gagal membaca tiket:', e.code); setListErr(true); setTkLoaded(true) }), [])

  ckRef.current = checkins
  const aktif = tickets.filter(t => t.status !== 'dicabut'), hadir = aktif.filter(t => t.status === 'terpakai').length

  // Pesan jelas untuk setiap status tiket
  const cekStatus = (t) => {
    if (t.status === 'dicabut') return `Tiket atas nama ${t.participantName} sudah dinonaktifkan panitia.`
    if (t.status === 'terpakai') {
      const c = ckRef.current.find(x => x.ticketId === t.id)
      const siapa = c?.isRepresentative ? ` (diwakili ${c.representativeName})` : ''
      return `Tiket atas nama ${t.participantName} sudah digunakan${t.usedAt ? ' pada ' + fmt(t.usedAt) : ''}${siapa}.`
    }
    return ''
  }

  // Satu langkah: tiket valid langsung dicatat hadir (transaksi mencegah dobel check-in dari dua perangkat)
  const checkIn = async (id, via) => {
    try {
      const ref = doc(db, 'tickets', id), cref = doc(collection(db, 'checkins')); let info
      await runTransaction(db, async (tx) => {
        const t = await tx.get(ref)
        if (!t.exists()) throw new Error('Tiket tidak dikenal.')
        const d = t.data()
        if (d.status === 'dicabut') throw new Error('Tiket sudah dinonaktifkan.')
        if (d.status !== 'aktif') throw new Error('Tiket ini baru saja digunakan di perangkat lain.')
        tx.update(ref, { status: 'terpakai', usedAt: serverTimestamp(), usedBy: auth.currentUser.email })
        tx.set(cref, { participantId: d.participantId, participantName: d.participantName, ticketId: id, ticketCode: ticketCode(id), via,
          isRepresentative: false, representativeName: null, officerEmail: auth.currentUser.email, checkedInAt: serverTimestamp() })
        info = { name: d.participantName, institution: d.institution, code: showCode(id) }
      })
      addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'check-in' + (via === 'manual' ? ' manual' : ''), participant: info.name, representative: null }).catch(() => {})
      setRes({ ok: true, ...info, checkinId: cref.id, ticketId: id })
    } catch (er) { setRes({ ok: false, title: 'Check-in gagal', text: er.message }) }
  }

  // Tombol "Diwakilkan?" di popup: melengkapi data check-in yang baru dibuat
  const setWakil = async (name) => {
    await updateDoc(doc(db, 'checkins', res.checkinId), { isRepresentative: true, representativeName: name })
    addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'perwakilan', participant: res.name, representative: name }).catch(() => {})
  }

  // Kamera hanya menyala saat tab "Scan kamera" aktif
  useEffect(() => {
    if (mode !== 'kamera') return
    setCamErr(''); setCamReady(false); lock.current = false
    const s = new Html5Qrcode('reader')
    const started = s.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, async (text) => {
      if (lock.current) return; lock.current = true
      const p = parseTicketInput(text)
      try {
        if (!p.token) throw new Error('QR ini bukan tiket seminar yang terdaftar.')
        const snap = await getDoc(doc(db, 'tickets', p.token))
        if (!snap.exists()) throw new Error('QR ini bukan tiket seminar yang terdaftar.')
        const t = { id: snap.id, ...snap.data() }, msg = cekStatus(t)
        if (msg) throw Object.assign(new Error(msg), { warn: t.status === 'terpakai' })
        await checkIn(t.id, 'qr')
      } catch (e) { setRes({ ok: false, warn: !!e.warn, title: e.warn ? 'Tiket sudah dipakai' : 'Tiket tidak valid', text: e.message }) }
    }).then(() => setCamReady(true)).catch(() => setCamErr('Kamera tidak dapat dibuka. Izinkan akses kamera di browser lalu tekan "Coba lagi", atau gunakan tab Input manual.'))
    return () => { started.then(() => s.isScanning && s.stop()).then(() => s.clear()).catch(() => {}) }
  }, [mode, camKey])

  const ganti = (m) => { if (m === mode) return; setMode(m); setManualErr(''); if (m === 'manual') setTimeout(() => codeRef.current?.focus(), 50) }

  // Pencarian langsung (live): hasil muncul setiap ketikan; nama, instansi, nomor tiket, atau tautan tiket. Satu sentuhan = check-in.
  const q = code.trim(), qn = normCode(q), ql = q.toLowerCase()
  const isLink = /\/tiket\/|^[\w-]{16,80}$/.test(q)
  const hits = !q ? [] : isLink ? tickets.filter(t => t.id === parseTicketInput(q).token)
    : tickets.filter(t => (t.participantName || '').toLowerCase().includes(ql) || (t.institution || '').toLowerCase().includes(ql) || (qn.length >= 3 && normCode(ticketCode(t.id)).includes(qn)))
      .sort((x, y) => (x.participantName || '').localeCompare(y.participantName || ''))
  const pilih = async (t) => {
    if (busy) return
    const msg = cekStatus(t)
    if (msg) { lock.current = true; return setRes({ ok: false, warn: t.status === 'terpakai', title: t.status === 'terpakai' ? 'Tiket sudah dipakai' : 'Tiket tidak valid', text: msg }) }
    lock.current = true; setBusy(true); await checkIn(t.id, 'manual'); setBusy(false)
  }
  const cari = (e) => { e.preventDefault(); if (hits.length === 1) pilih(hits[0]) }

  // Salah scan: tiket kembali aktif dan catatan hadir dihapus (hanya petugas yang membuatnya, dalam 2 menit; dijaga firestore.rules)
  const batal = async () => {
    await runTransaction(db, async (tx) => {
      const tr = doc(db, 'tickets', res.ticketId), t = await tx.get(tr)
      if (!t.exists() || t.data().status !== 'terpakai') throw new Error('Tiket tidak dalam status terpakai.')
      tx.update(tr, { status: 'aktif', usedAt: deleteField(), usedBy: deleteField() }); tx.delete(doc(db, 'checkins', res.checkinId))
    })
    addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'batalkan check-in', participant: res.name }).catch(() => {})
    setNote(`Check-in ${res.name} dibatalkan. Tiketnya bisa dipindai lagi.`); setTimeout(() => setNote(''), 5000); close()
  }

  // Jeda singkat setelah popup ditutup agar QR yang sama tidak terbaca ulang
  const close = () => { setRes(null); if (mode === 'manual') { lock.current = false; setCode(''); setTimeout(() => codeRef.current?.focus(), 50) } else setTimeout(() => { lock.current = false }, 1500) }

  const Tab = ({ m, icon, label }) => <button type="button" role="tab" aria-selected={mode === m} className={`scan-tab ${mode === m ? 'on' : ''}`} onClick={() => ganti(m)}><i className={`bi bi-${icon}`}/>{label}</button>

  return <>
    <div className="d-flex gap-2 flex-wrap align-items-end">
      <div className="me-auto"><h1 className="h4">Scan dan check-in</h1><p className="sub mb-0">Arahkan kamera ke QR tiket. Peserta langsung tercatat hadir.</p></div>
      <div className="scan-count" aria-live="polite">{tkLoaded ? <><b>{hadir}</b><span> / {aktif.length}</span><small>sudah check-in</small></> : <Skel w="9rem" h="2rem" r="10px"/>}</div>
    </div>
    {note && <div className="alert alert-warning mt-3 mb-0" role="status"><i className="bi bi-arrow-counterclockwise"/> {note}</div>}
    <div className="scan mt-3">
      <div>
        <div className="scan-tabs" role="tablist"><Tab m="kamera" icon="qr-code-scan" label="Scan kamera"/><Tab m="manual" icon="keyboard" label="Input manual"/></div>
        {mode === 'kamera' ? <>
          {camErr && <div className="alert alert-danger d-flex gap-2 align-items-center flex-wrap"><span className="flex-fill">{camErr}</span><button className="btn btn-sm btn-outline-danger" onClick={() => setCamKey(k => k + 1)}>Coba lagi</button></div>}
          <div className="reader-wrap"><div id="reader"/>{!camReady && !camErr && <div className="reader-skel" aria-busy="true" aria-label="Membuka kamera"><Skel h="100%" r="14px"/></div>}</div>
          <p className="small text-muted mt-2 mb-0">QR tidak terbaca atau peserta lupa membawa tiket? Pilih tab <b>Input manual</b> lalu cari berdasarkan nama.</p>
        </> : <form className="panel" onSubmit={cari}>
          <label htmlFor="kode" className="form-label fw-semibold">Cari peserta atau nomor tiket</label>
          <input id="kode" ref={codeRef} type="search" className="form-control form-control-lg" placeholder="Ketik nama atau nomor tiket" value={code} autoComplete="off" autoCapitalize="off" spellCheck="false"
            onChange={e => setCode(e.target.value)}/>
          <div className="form-text">Hasil muncul saat mengetik. Sentuh nama peserta untuk langsung check-in. Huruf besar atau kecil tidak masalah.</div>
          {listErr && <div className="alert alert-danger mt-2 mb-0">Pencarian belum bisa dipakai karena akses data tiket ditolak. Minta Super Admin mem-publish firestore.rules versi terbaru.</div>}
          {!listErr && q && !tkLoaded && <div className="mt-2" aria-busy="true"><Skel h="3.6rem" r="12px" className="mb-2"/><Skel h="3.6rem" r="12px"/></div>}
          {!listErr && q && tkLoaded && <div className="hits mt-2" role="listbox" aria-label="Hasil pencarian">
            {hits.slice(0, 6).map(t => <button type="button" role="option" key={t.id} className={`hit ${t.status}`} disabled={busy} onClick={() => pilih(t)}>
              <span className="flex-fill text-start"><b>{t.participantName}</b><small className="d-block text-muted">{t.institution || 'Tanpa instansi'} · <span className="tk-code">{showCode(t.id)}</span></small></span>
              {t.status === 'aktif' ? <span className="hit-go"><i className="bi bi-check2-circle"/> Check-in</span> : t.status === 'terpakai' ? <span className="badge text-bg-warning">Sudah hadir</span> : <span className="badge text-bg-danger">Dinonaktifkan</span>}</button>)}
            {hits.length > 6 && <div className="small text-muted text-center py-1">Masih ada {hits.length - 6} hasil lain. Ketik lebih lengkap untuk mempersempit.</div>}
            {!hits.length && <div className="text-muted text-center py-3">Tidak ditemukan. Periksa ejaan nama atau nomor tiket.</div>}
          </div>}
        </form>}
      </div>
      <div>
        <div className="panel text-center text-muted py-4"><i className={`bi bi-${mode === 'kamera' ? 'upc-scan' : 'keyboard'} fs-1 d-block mb-2`}/>
          {mode === 'kamera' ? 'Menunggu QR tiket…' : 'Menunggu nomor tiket…'}<div className="small">Hasil check-in muncul sebagai popup.</div></div>
        <div className="panel">
          <div className="fw-semibold mb-1">Check-in terakhir</div>
          {loadCk && <SkelList rows={3}/>}
          {!loadCk && checkins.slice(0, 5).map(c => <div className="recent" key={c.id}><div><div>{c.participantName}</div>{c.isRepresentative && <small>Diwakili {c.representativeName}</small>}</div><small>{jam(c.checkedInAt)}</small></div>)}
          {!loadCk && !checkins.length && <div className="small text-muted">Belum ada yang check-in.</div>}
        </div>
      </div>
    </div>
    {res && (res.ok ? <CheckinModal {...res} onRep={setWakil} onUndo={batal} onClose={close}/> : <ResultModal {...res} onClose={close}/>)}
  </>
}
