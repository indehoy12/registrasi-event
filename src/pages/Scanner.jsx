import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { addDoc, collection, deleteField, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { ResultModal, CheckinModal, Skel, SkelList, useDialog } from '../ui'
import { useColState, useSeminar, jam, showCode, ticketCode, normCode, parseTicketInput, hariList, hariAktif, hariKunci, hariLabel, usedOn, ckDay } from '../hooks'

const JENDELA = 10 * 60 * 1000   // waktu koreksi check-in oleh petugas (sama dengan firestore.rules)
export default function Scanner() {
  const ask = useDialog(), [ed, setEd] = useState(null)
  const lock = useRef(false), codeRef = useRef(null), ckRef = useRef([])
  const [mode, setMode] = useState('kamera')              // 'kamera' | 'manual'
  const [tickets, setTickets] = useState([]), [listErr, setListErr] = useState(false)
  const [res, setRes] = useState(null), [busy, setBusy] = useState(false), [note, setNote] = useState('')
  const [camErr, setCamErr] = useState(''), [camKey, setCamKey] = useState(0), [camReady, setCamReady] = useState(false)
  const [code, setCode] = useState(''), [manualErr, setManualErr] = useState('')
  const [checkins, loadCk] = useColState('checkins', 'checkedInAt'), [tkLoaded, setTkLoaded] = useState(false)
  // Hari kegiatan: otomatis mengikuti tanggal hari ini, bisa diganti manual bila kegiatan 2 hari
  const { sem, loaded: semLoaded } = useSeminar(), days = hariList(sem), [pick, setPick] = useState(null), multi = days.length > 1
  const day = pick && days.includes(pick) ? pick : hariAktif(days), dayNo = days.indexOf(day) + 1
  const dayRef = useRef(day), daysRef = useRef(days), semRef = useRef(semLoaded); dayRef.current = day; daysRef.current = days; semRef.current = semLoaded
  const st = (t) => t.status === 'dicabut' ? 'dicabut' : usedOn(t, day, days) ? 'terpakai' : 'aktif'

  // Daftar tiket (live) dipakai untuk pencarian nomor tiket dan penghitung kehadiran
  useEffect(() => onSnapshot(collection(db, 'tickets'),
    s => { setTickets(s.docs.map(d => ({ id: d.id, ...d.data() }))); setListErr(false); setTkLoaded(true) },
    e => { console.error('Gagal membaca tiket:', e.code); setListErr(true); setTkLoaded(true) }), [])

  ckRef.current = checkins
  const aktif = tickets.filter(t => t.status !== 'dicabut'), hadir = aktif.filter(t => usedOn(t, day, days)).length

  // Pesan jelas untuk setiap status tiket
  const cekStatus = (t) => {
    const d = dayRef.current, ds = daysRef.current
    if (t.status === 'dicabut') return `Tiket atas nama ${t.participantName} sudah dinonaktifkan panitia.`
    const u = usedOn(t, d, ds)
    if (u) {
      const c = ckRef.current.find(x => x.ticketId === t.id && ckDay(x, ds) === d)
      const siapa = c?.isRepresentative ? ` (diwakili ${c.representativeName})` : ''
      return `Tiket atas nama ${t.participantName} sudah digunakan${ds.length > 1 ? ` pada hari ke-${ds.indexOf(d) + 1}` : ''}${u.toDate ? ' pukul ' + jam(u) : ''}${siapa}.`
    }
    return ''
  }

  // Satu langkah: tiket valid langsung dicatat hadir (transaksi mencegah dobel check-in dari dua perangkat)
  const checkIn = async (id, via) => {
    try {
      // Hari check-in disimpan sebagai tanggal. Tanpa tanggal seminar, data akan tersimpan dengan kunci sementara dan tidak cocok lagi setelah tanggal diisi.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayRef.current)) throw new Error(semRef.current ? 'Tanggal seminar belum diisi. Minta admin mengisinya di menu Info seminar sebelum check-in dimulai.' : 'Informasi seminar masih dimuat. Coba lagi sebentar.')
      const ref = doc(db, 'tickets', id), cref = doc(collection(db, 'checkins')); let info
      await runTransaction(db, async (tx) => {
        const t = await tx.get(ref)
        if (!t.exists()) throw new Error('Tiket tidak dikenal.')
        const d = t.data()
        const dy = dayRef.current
        if (d.status === 'dicabut') throw new Error('Tiket sudah dinonaktifkan.')
        if (usedOn(d, dy, daysRef.current)) throw new Error('Tiket ini sudah tercatat hadir pada hari ini (mungkin baru saja dipindai di perangkat lain).')
        tx.update(ref, { status: 'aktif', [`usedDays.${dy}`]: serverTimestamp(), usedAt: serverTimestamp(), usedBy: auth.currentUser.email })
        tx.set(cref, { participantId: d.participantId, participantName: d.participantName, ticketId: id, ticketCode: ticketCode(id), via, day: dy,
          isRepresentative: false, representativeName: null, officerEmail: auth.currentUser.email, checkedInAt: serverTimestamp() })
        info = { name: d.participantName, institution: d.institution, code: showCode(id), day: dy, hari: daysRef.current.length > 1 ? `Hari ke-${daysRef.current.indexOf(dy) + 1}` : '' }
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
        if (msg) throw Object.assign(new Error(msg), { warn: !!usedOn(t, dayRef.current, daysRef.current) })
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
    if (msg) { lock.current = true; return setRes({ ok: false, warn: st(t) === 'terpakai', title: st(t) === 'terpakai' ? 'Tiket sudah dipakai' : 'Tiket tidak valid', text: msg }) }
    lock.current = true; setBusy(true); await checkIn(t.id, 'manual'); setBusy(false)
  }
  const cari = (e) => { e.preventDefault(); if (hits.length === 1) pilih(hits[0]) }

  // Salah scan: tiket kembali aktif dan catatan hadir dihapus (hanya petugas yang membuatnya, dalam 10 menit; dijaga firestore.rules)
  const batalkan = async (c) => {
    const dy = ckDay(c, daysRef.current)
    await runTransaction(db, async (tx) => {
      const tr = doc(db, 'tickets', c.ticketId), t = await tx.get(tr)
      if (t.exists() && usedOn(t.data(), dy, daysRef.current)) tx.update(tr, { status: 'aktif', [`usedDays.${dy}`]: deleteField() })
      tx.delete(doc(db, 'checkins', c.id))
    })
    addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'batalkan check-in', participant: c.participantName }).catch(() => {})
  }
  const flash = (t) => { setNote(t); setTimeout(() => setNote(''), 6000) }
  // Dari popup (tepat setelah scan)
  const batal = async () => { await batalkan({ id: res.checkinId, ticketId: res.ticketId, day: res.day, participantName: res.name }); flash(`Check-in ${res.name} dibatalkan. Tiketnya bisa dipindai lagi.`); close() }
  // Dari daftar "Check-in terakhir" (setelah popup ditutup), dengan konfirmasi
  const batalDaftar = async (c) => {
    lock.current = true
    const ya = await ask({ title: 'Batalkan check-in?', text: `Check-in ${c.participantName} dihapus dan QR-nya bisa dipindai lagi.`, ok: 'Batalkan check-in', danger: true, icon: 'arrow-counterclockwise' })
    if (ya) { try { await batalkan(c); flash(`Check-in ${c.participantName} dibatalkan. Tiketnya bisa dipindai lagi.`) } catch { flash('Gagal membatalkan. Waktu koreksi 10 menit mungkin sudah lewat, hubungi admin.') } }
    if (!res) lock.current = false
  }
  const simpanEd = async (e) => {
    e.preventDefault(); const name = ed.who === 'wakil' ? ed.name.trim() : ''; if (ed.who === 'wakil' && !name) return
    try { await updateDoc(doc(db, 'checkins', ed.c.id), { isRepresentative: !!name, representativeName: name || null })
      addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'ubah perwakilan', participant: ed.c.participantName, representative: name || null }).catch(() => {})
      flash(`Data ${ed.c.participantName} diperbarui.`)
    } catch { flash('Gagal menyimpan. Waktu koreksi 10 menit mungkin sudah lewat, hubungi admin.') }
    setEd(null); if (!res) lock.current = false
  }
  const bukaEd = (c) => { lock.current = true; setEd({ c, who: c.isRepresentative ? 'wakil' : 'sendiri', name: c.representativeName || '' }) }
  const bisaKoreksi = (c) => c.officerEmail === auth.currentUser?.email && c.checkedInAt?.toMillis && Date.now() - c.checkedInAt.toMillis() < JENDELA

  // Jeda singkat setelah popup ditutup agar QR yang sama tidak terbaca ulang
  const close = () => { setRes(null); if (mode === 'manual') { lock.current = false; setCode(''); setTimeout(() => codeRef.current?.focus(), 50) } else setTimeout(() => { lock.current = false }, 1500) }

  const Tab = ({ m, icon, label }) => <button type="button" role="tab" aria-selected={mode === m} className={`scan-tab ${mode === m ? 'on' : ''}`} onClick={() => ganti(m)}><i className={`bi bi-${icon}`}/>{label}</button>

  return <>
    <div className="d-flex gap-2 flex-wrap align-items-end">
      <div className="me-auto"><h1 className="h4">Scan dan check-in{multi && <span className="badge text-bg-success ms-2 align-middle fs-6">Hari ke-{dayNo}</span>}</h1><p className="sub mb-0">Arahkan kamera ke QR tiket. Peserta langsung tercatat hadir.</p></div>
      <div className="scan-count" aria-live="polite">{tkLoaded ? <><b>{hadir}</b><span> / {aktif.length}</span><small>sudah check-in</small></> : <Skel w="9rem" h="2rem" r="10px"/>}</div>
    </div>
    {multi && <div className="mt-3"><div className="who" style={{ maxWidth: 420 }} role="radiogroup" aria-label="Hari kegiatan">
      {days.map(d => <button type="button" role="radio" aria-checked={d === day} key={d} className={d === day ? 'on' : ''} style={{ minHeight: '3rem', flexDirection: 'row', justifyContent: 'center', gap: '.4rem' }} onClick={() => setPick(d)}><i className="bi bi-calendar-check" style={{ fontSize: '1.1rem' }}/>{hariLabel(days, d)}</button>)}</div>
      {!days.includes(hariKunci()) && <div className="small text-warning-emphasis mt-1"><i className="bi bi-exclamation-triangle-fill"/> Tanggal hari ini tidak sama dengan jadwal kegiatan. Pastikan hari yang dipilih sudah benar.</div>}</div>}
    {semLoaded && !sem.date && <div className="alert alert-danger mt-3 mb-0" role="alert"><i className="bi bi-exclamation-octagon-fill"/> Tanggal seminar belum diisi, jadi check-in dinonaktifkan. Minta admin mengisinya di menu <b>Info seminar</b>.</div>}
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
            {hits.slice(0, 6).map(t => <button type="button" role="option" key={t.id} className={`hit ${st(t)}`} disabled={busy} onClick={() => pilih(t)}>
              <span className="flex-fill text-start"><b>{t.participantName}</b><small className="d-block text-muted">{t.institution || 'Tanpa instansi'} · <span className="tk-code">{showCode(t.id)}</span></small></span>
              {st(t) === 'aktif' ? <span className="hit-go"><i className="bi bi-check2-circle"/> Check-in</span> : st(t) === 'terpakai' ? <span className="badge text-bg-warning">Sudah hadir</span> : <span className="badge text-bg-danger">Dinonaktifkan</span>}</button>)}
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
          {!loadCk && checkins.filter(c => ckDay(c, days) === day).slice(0, 8).map(c => <div className="recent" key={c.id}><div><div>{c.participantName}</div>{c.isRepresentative && <small>Diwakili {c.representativeName}</small>}</div>
            <div className="text-end"><small>{jam(c.checkedInAt)}</small>{bisaKoreksi(c) && <div className="text-nowrap"><button className="btn btn-link btn-sm p-0 me-2" onClick={() => bukaEd(c)}>Ubah</button><button className="btn btn-link btn-sm text-danger p-0" onClick={() => batalDaftar(c)}>Batalkan</button></div>}</div></div>)}
          {!loadCk && !checkins.some(c => ckDay(c, days) === day) && <div className="small text-muted">Belum ada yang check-in.</div>}
          {!loadCk && checkins.some(bisaKoreksi) && <div className="small text-muted mt-2">Salah peserta atau perwakilan? Tekan <b>Ubah</b> atau <b>Batalkan</b>, tersedia 10 menit setelah check-in.</div>}
        </div>
      </div>
    </div>
    {ed && <div className="mdl-back"><form className="mdl" onSubmit={simpanEd} role="dialog" aria-modal="true" aria-labelledby="ed-t">
      <h2 id="ed-t" className="h5 mb-1">Ubah data kehadiran</h2><p className="text-muted">{ed.c.participantName}</p>
      <div className="who mb-3"><button type="button" className={ed.who === 'sendiri' ? 'on' : ''} onClick={() => setEd({ ...ed, who: 'sendiri' })}><i className="bi bi-person-check"/>Peserta sendiri</button>
        <button type="button" className={ed.who === 'wakil' ? 'on' : ''} onClick={() => setEd({ ...ed, who: 'wakil' })}><i className="bi bi-person-badge"/>Diwakilkan</button></div>
      {ed.who === 'wakil' && <><label className="form-label" htmlFor="en">Nama perwakilan</label><input id="en" className="form-control form-control-lg mb-3" autoFocus autoComplete="off" value={ed.name} onChange={e => setEd({ ...ed, name: e.target.value })}/></>}
      <div className="mdl-act"><button type="button" className="btn btn-outline-secondary" onClick={() => { setEd(null); if (!res) lock.current = false }}>Batal</button><button className="btn btn-primary" disabled={ed.who === 'wakil' && !ed.name.trim()}>Simpan</button></div></form></div>}
    {res && (res.ok ? <CheckinModal {...res} onRep={setWakil} onUndo={batal} onClose={close}/> : <ResultModal {...res} onClose={close}/>)}
  </>
}
