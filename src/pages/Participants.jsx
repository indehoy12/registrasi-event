import { useDialog, Badge, Skel, SkelRows } from '../ui'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'; import { Link } from 'react-router-dom'
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { auth, db } from '../firebase'; import { useColState, useSeminar, tgl, waNumber, validWa, validEmail, maskWa, maskEmail, hariList, hariTeks, normHari, cariCocok, hariPeserta, ckDay, urutNama } from '../hooks'
const empty = { name:'', email:'', whatsapp:'', institution:'', pimpinan:'', domisili:'', wilayah:'', bidang:'', hari:'', status:'terdaftar' }
// Undangan menyimpan salinan nama, perusahaan, bidang perusahaan, dan kontak (masked) peserta. Setelah data peserta diubah, salinan itu disamakan.
// Bila WhatsApp/email berganti, status kirim direset agar muncul lagi sebagai "Belum" di menu Distribusi.
async function syncTiket(id, d, lama) {
  const s = await getDocs(query(collection(db, 'tickets'), where('participantId', '==', id))); if (s.empty) return
  const b = writeBatch(db)
  s.docs.forEach(t => { const x = { participantName: d.name, institution: d.institution || '', pimpinan: d.pimpinan || '', domisili: d.domisili || '', wilayah: d.wilayah || '', bidang: d.bidang || '', emailMasked: maskEmail(d.email), waMasked: maskWa(d.whatsapp), hari: normHari(d.hari) }
    if (lama && normHari(lama.hari) !== normHari(d.hari)) { x.sentAt = null; x.sentVia = null; x.emailSentAt = null }   // hari berubah: isi pesan lama sudah tidak sesuai, kirim ulang
    if (lama && waNumber(lama.whatsapp) !== d.whatsapp) { x.sentAt = null; x.sentVia = null }
    if (lama && (lama.email || '') !== d.email) x.emailSentAt = null
    b.update(t.ref, x) })
  await b.commit()
}
// Satu kolom form: label di atas, ikon, contoh isian, dan petunjuk singkat
const Field = ({ id, label, req, icon, hint, error, children }) => <div>
  <label className="form-label pf-label" htmlFor={id}>{label}{req ? <span className="pf-req" title="Wajib diisi"> *</span> : <span className="pf-opt"> (opsional)</span>}</label>
  <div className={'pf-input' + (error ? ' has-err' : '')}><i className={'bi bi-' + icon} aria-hidden="true"/>{children}</div>
  {error ? <div className="pf-err" role="alert"><i className="bi bi-exclamation-circle"/> {error}</div> : hint && <div className="pf-hint">{hint}</div>}</div>
export default function Participants() {
  const ask = useDialog(), { sem } = useSeminar(), days = hariList(sem), multi = days.length > 1
  // Urutan daftar: Hari ke-1 paling atas, lalu Hari ke-2, lalu peserta Kedua hari; di tiap kelompok diurut abjad nama. Kegiatan 1 hari: abjad saja.
  const grupHari = (r) => { if (!multi) return 0; const h = hariPeserta(r, days); return h.length === days.length ? 2 : h[0] === 1 ? 0 : 1 }
  const [raw, loading] = useColState('participants'), [cs] = useColState('checkins'), rows = useMemo(() => [...raw].sort((a, b) => grupHari(a) - grupHari(b) || urutNama(a, b)), [raw, days.join()]), [hal, setHal] = useState(1), [per, setPer] = useState(25), [f, setF] = useState(empty), [q, setQ] = useState(''), [edit, setEdit] = useState(null), [err, setErr] = useState(''), [fe, setFe] = useState({})
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [ok, setOk] = useState(''), nameRef = useRef(null)
  const bukaTambah = () => { setEdit(null); setErr(''); setOk(''); setFe({}); setF({ ...empty, hari: multi ? '?' : '' }); setOpen(true) }   // hari '?' = belum memilih batch
  const bukaUbah = (r) => { setErr(''); setOk(''); setFe({}); setEdit(r.id); setF({ name: r.name, email: r.email || '', whatsapp: r.waAsli || r.whatsapp || '', institution: r.institution || '', pimpinan: r.pimpinan || '', domisili: r.domisili || '', wilayah: r.wilayah || '', bidang: r.bidang || '', hari: normHari(r.hari), status: r.status || 'terdaftar' }); setOpen(true) }
  const tutup = () => { if (busy) return; setOpen(false); setEdit(null); setF(empty); setFe({}); setErr(''); setOk('') }
  useEffect(() => { if (!open) return; const k = (e) => e.key === 'Escape' && tutup(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) })
  const ubah = (k, v) => { setF(x => ({ ...x, [k]: v })); if (fe[k]) setFe(x => ({ ...x, [k]: '' })); if (ok) setOk('') }
  // lagi = true: setelah tersimpan, form dikosongkan dan tetap terbuka untuk peserta berikutnya (batch tetap sama)
  const save = async (e, lagi = false) => { e?.preventDefault(); if (busy) return; setErr('')
    const d = { ...f, name: f.name.trim(), email: f.email.trim(), institution: f.institution.trim(), pimpinan: (f.pimpinan || '').trim(), domisili: (f.domisili || '').trim(), wilayah: (f.wilayah || '').trim(), bidang: (f.bidang || '').trim(), whatsapp: waNumber(f.whatsapp), waAsli: f.whatsapp.trim(), hari: normHari(f.hari) }, er = {}
    if (!d.name) er.name = 'Nama PIC/Admin wajib diisi.'
    if (multi && f.hari === '?') er.hari = 'Pilih batch peserta.'
    if (f.whatsapp.trim() && !validWa(d.whatsapp)) er.whatsapp = 'Nomor tidak valid. Harus nomor HP berawalan 08 atau 628, contoh: 08123456789 atau 628123456789, atau kosongkan.'
    else if (d.whatsapp && rows.some(r => r.id !== edit && waNumber(r.whatsapp) === d.whatsapp)) er.whatsapp = 'Nomor WhatsApp ini sudah terdaftar.'
    if (d.email && !validEmail(d.email)) er.email = 'Format email tidak valid (contoh: nama@gmail.com), atau kosongkan.'
    setFe(er); if (Object.keys(er).length) { document.getElementById('pf-' + Object.keys(er)[0])?.focus(); return }
    setBusy(true)
    try { if (edit) { const lama = rows.find(r => r.id === edit); await updateDoc(doc(db,'participants',edit), d)
        try { await syncTiket(edit, d, lama) } catch (ex2) { setErr('Data peserta tersimpan, tetapi undangannya gagal diperbarui (' + (ex2.code || ex2.message) + '). Simpan ulang data peserta ini untuk mencoba lagi.'); setBusy(false); return } }
      else await addDoc(collection(db,'participants'), { ...d, createdAt: serverTimestamp() })
      if (lagi && !edit) { setOk(d.name + ' berhasil ditambahkan. Silakan isi peserta berikutnya.'); setF({ ...empty, hari: multi ? f.hari : '' }); setFe({}); setBusy(false); setTimeout(() => nameRef.current?.focus(), 0); return }
      setBusy(false); setOpen(false); setF(empty); setEdit(null); setOk('')
    } catch (ex) { setBusy(false); setErr(ex.code === 'permission-denied' ? 'Ditolak oleh aturan Firestore (permission-denied). Periksa dokumen akun di koleksi users (role dan active) dan pastikan firestore.rules sudah di-Publish.' : 'Gagal menyimpan: ' + (ex.code || '') + ' ' + ex.message) } }
  // Hapus peserta sekaligus mencabut undangannya (satu batch), agar tidak ada undangan aktif tanpa pemilik
  const hapus = async (r) => {
    if (!await ask({ title:'Hapus peserta?', text:`${r.name} akan dihapus dari daftar dan undangannya otomatis dicabut. Riwayat check-in yang sudah ada tetap tersimpan.`, ok:'Hapus', danger:true })) return
    try { const s = await getDocs(query(collection(db,'tickets'), where('participantId','==',r.id))), b = writeBatch(db)
      s.docs.forEach(t => { if (t.data().status !== 'dicabut') b.update(t.ref, { status: 'dicabut' }) })
      b.delete(doc(db,'participants',r.id)); await b.commit()
      addDoc(collection(db,'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: 'hapus peserta', participant: r.name }).catch(() => {})
    } catch (ex) { setErr('Gagal menghapus peserta: ' + (ex.code || '') + ' ' + ex.message) } }
  const exp = async () => { setErr(''); try { const { unduhPeserta } = await import('../excel'); await unduhPeserta({ sem, days, ps: rows.map(r => ({ ...r, whatsapp: r.waAsli || r.whatsapp, statusHadir: statusTeks(r) })), hariTeks, tgl }) } catch (ex) { setErr('Gagal membuat file Excel: ' + (ex.message || ex)) } }
  // Status check-in diambil dari catatan check-in; kegiatan 2 hari: satu status per hari yang dijadwalkan (atau sudah dihadiri)
  const sudah = useMemo(() => new Set(cs.map(c => c.participantId + '|' + ckDay(c, days))), [cs, days.join()])
  const hariStatus = (r) => [...new Set([...hariPeserta(r, days), ...days.flatMap((d, i) => sudah.has(r.id + '|' + d) ? [i + 1] : [])])].sort().map(n => ({ n, on: sudah.has(r.id + '|' + days[n - 1]) }))
  const statusTeks = (r) => hariStatus(r).map(s => (multi ? `Hari ${s.n}: ` : '') + (s.on ? 'Sudah check-in' : 'Belum check-in')).join('; ')
  const list = rows.filter(r => cariCocok(q.trim(), [r.name, r.email, r.whatsapp, r.waAsli, r.institution, r.pimpinan, r.domisili, r.wilayah, r.bidang, multi ? hariTeks(r, days) : '', statusTeks(r)].join(' ')))
  const jml = Math.max(1, Math.ceil(list.length / per)), page = Math.min(hal, jml), mulai = (page - 1) * per, tampil = list.slice(mulai, mulai + per)
  const nomorHal = (() => { const a = [...new Set([1, jml, page - 1, page, page + 1].filter(n => n >= 1 && n <= jml))].sort((x, y) => x - y), o = []; a.forEach((n, i) => { if (i && n - a[i - 1] > 1) o.push('…' + n); o.push(n) }); return o })()
  const inp = (k, p, extra = {}) => <input id={'pf-' + k} className={'form-control' + (fe[k] ? ' is-invalid' : '')} placeholder={p} value={f[k] || ''} autoComplete="off" disabled={busy} onChange={e => ubah(k, e.target.value)} {...extra}/>
  return <><div className="d-flex gap-2 mb-3 flex-wrap"><h1 className="h4 me-auto">Peserta ({loading ? <Skel w="2rem" h="1rem" className="align-middle"/> : rows.length})</h1>
    <button className="btn btn-primary btn-sm" onClick={bukaTambah}><i className="bi bi-plus-lg"/> Tambah peserta</button>
    <Link className="btn btn-outline-primary btn-sm" to="/admin/participants/import"><i className="bi bi-file-earmark-arrow-up"/> Import Excel</Link>
    <button className="btn btn-outline-secondary btn-sm" disabled={loading} onClick={exp}><i className="bi bi-download"/> Export Excel</button></div>
    {err && !open && <div className="alert alert-danger">{err}</div>}
    <div className="d-flex align-items-center gap-3 flex-wrap mb-2"><input className="form-control" style={{ maxWidth: 420 }} aria-label="Cari peserta" placeholder="Cari email, perusahaan, pimpinan, PIC, nomor HP, domisili, wilayah, atau jenis usaha" type="search" autoComplete="off" value={q} onChange={e => { setQ(e.target.value); setHal(1) }}/>
      {!loading && q.trim() && <span className="small text-muted" role="status" aria-live="polite">{list.length} dari {rows.length} peserta</span>}</div>
    <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th style={{ width: '3rem' }}>No</th><th>Email Address</th><th>Nama Perusahaan/Nama Individu</th><th>Nama PIC/Admin</th><th>No HP PIC/Admin</th><th>Domisili</th><th>Wilayah Operasional Perusahaan</th><th>Jenis Usaha</th>{multi && <th>Hari</th>}<th>Status check-in</th><th/></tr></thead><tbody>
      {loading && <SkelRows rows={6} cols={multi ? 11 : 10}/>}
      {!loading && tampil.map((r, i) => <Fragment key={r.id}>{multi && (i === 0 || grupHari(tampil[i - 1]) !== grupHari(r)) && <tr className="table-light"><td colSpan={11} className="small fw-semibold">{['Hari ke-1', 'Hari ke-2', 'Kedua hari'][grupHari(r)]}</td></tr>}<tr><td className="text-muted">{mulai + i + 1}</td><td>{r.email}</td><td>{r.institution}{r.pimpinan && <div className="small text-muted">{r.pimpinan}</div>}</td><td>{r.name}</td><td>{r.whatsapp}</td><td>{r.domisili}</td><td>{r.wilayah}</td><td>{r.bidang}</td>{multi && <td className="text-nowrap">{hariTeks(r, days)}</td>}<td className="text-nowrap">{hariStatus(r).map(s => <div key={s.n}><span className={'badge rounded-pill fw-medium text-bg-' + (s.on ? 'success' : 'secondary')}>{multi ? `Hari ${s.n}: ` : ''}{s.on ? 'Sudah check-in' : 'Belum check-in'}</span></div>)}</td>
        <td style={{ width: '1%' }}><div className="d-flex flex-column align-items-center gap-1">
          <button type="button" className="btn btn-link p-1 lh-1" style={{ fontSize: '1.15rem' }} title="Ubah" aria-label={`Ubah ${r.name}`} onClick={() => bukaUbah(r)}><i className="bi bi-pencil-square"/></button>
          <button type="button" className="btn btn-link text-danger p-1 lh-1" style={{ fontSize: '1.15rem' }} title="Hapus" aria-label={`Hapus ${r.name}`} onClick={() => hapus(r)}><i className="bi bi-trash3"/></button></div></td></tr></Fragment>)}
      {!loading && !list.length && <tr><td colSpan={multi ? 11 : 10} className="text-center text-muted py-4">{rows.length ? 'Tidak ada peserta yang cocok.' : 'Belum ada peserta. Tambahkan manual atau import Excel.'}</td></tr>}</tbody></table></div>
    {!loading && list.length > 0 && <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mt-2">
      <div className="d-flex align-items-center gap-2 small text-muted"><span role="status" aria-live="polite">Menampilkan {mulai + 1}–{Math.min(mulai + per, list.length)} dari {list.length} peserta</span>
        <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Jumlah peserta per halaman" value={per} onChange={e => { setPer(+e.target.value); setHal(1) }}>{[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / halaman</option>)}</select></div>
      {jml > 1 && <nav aria-label="Halaman peserta"><ul className="pagination pagination-sm mb-0">
        <li className={'page-item' + (page === 1 ? ' disabled' : '')}><button type="button" className="page-link" aria-label="Halaman sebelumnya" disabled={page === 1} onClick={() => setHal(page - 1)}>&laquo;</button></li>
        {nomorHal.map(n => typeof n === 'string' ? <li key={n} className="page-item disabled"><span className="page-link">…</span></li> : <li key={n} className={'page-item' + (n === page ? ' active' : '')}><button type="button" className="page-link" aria-current={n === page ? 'page' : undefined} onClick={() => setHal(n)}>{n}</button></li>)}
        <li className={'page-item' + (page === jml ? ' disabled' : '')}><button type="button" className="page-link" aria-label="Halaman berikutnya" disabled={page === jml} onClick={() => setHal(page + 1)}>&raquo;</button></li></ul></nav>}</div>}
    {open && <div className="mdl-back" onMouseDown={e => e.target === e.currentTarget && tutup()}>
      <form className="mdl mdl-form" role="dialog" aria-modal="true" aria-labelledby="pf-t" onSubmit={save} noValidate>
        <div className="pf-head"><div className="pf-ic"><i className={'bi bi-' + (edit ? 'pencil-square' : 'person-plus')}/></div>
          <div className="me-auto"><h2 id="pf-t" className="h5 mb-0">{edit ? 'Ubah data peserta' : 'Tambah peserta'}</h2>
            <div className="small text-muted">{edit ? 'Perubahan ikut diterapkan ke undangan peserta.' : 'Isi data di bawah. Tanda * wajib diisi.'}</div></div>
          <button type="button" className="btn-close" aria-label="Tutup" onClick={tutup}/></div>
        <div className="pf-body">
        {err && <div className="alert alert-danger py-2 small mb-3" role="alert">{err}</div>}
        {ok && <div className="alert alert-success py-2 small mb-3" role="status"><i className="bi bi-check-circle-fill"/> {ok}</div>}
        <div className="pf-sec">Perusahaan / Individu</div>
        <div className="row g-3">
          <div className="col-12"><Field id="pf-email" label="Email Address" icon="envelope" error={fe.email} hint="Boleh dikosongkan.">{inp('email', 'nama@perusahaan.co.id', { type: 'email', inputMode: 'email' })}</Field></div>
          <div className="col-12 col-md-6"><Field id="pf-institution" label="Nama Perusahaan/Nama Individu" icon="building">{inp('institution', 'Contoh: PT Maju Bersama', { type: 'text' })}</Field></div>
          <div className="col-12 col-md-6"><Field id="pf-pimpinan" label="Nama Pimpinan" icon="person-badge">{inp('pimpinan', 'Contoh: Bapak Andi Wijaya', { type: 'text' })}</Field></div>
          <div className="col-12 col-md-6"><Field id="pf-domisili" label="Domisili" icon="geo-alt">{inp('domisili', 'Contoh: Kota Bandung', { type: 'text' })}</Field></div>
          <div className="col-12 col-md-6"><Field id="pf-wilayah" label="Wilayah Operasional Perusahaan" icon="map">{inp('wilayah', 'Contoh: Jawa Barat', { type: 'text' })}</Field></div>
          <div className="col-12"><Field id="pf-bidang" label="Jenis Usaha" icon="briefcase">{inp('bidang', 'Contoh: Manufaktur', { type: 'text' })}</Field></div>
        </div>
        <div className="pf-sec">PIC / Admin</div>
        <div className="row g-3">
          <div className="col-12"><Field id="pf-name" label="Nama PIC/Admin" req icon="person" error={fe.name}>{inp('name', 'Contoh: Budi Santoso', { type: 'text', autoFocus: true, ref: nameRef })}</Field></div>
          <div className="col-12"><Field id="pf-whatsapp" label="No HP PIC/Admin" icon="whatsapp" error={fe.whatsapp} hint="Awali dengan 08 atau 628. Boleh dikosongkan.">{inp('whatsapp', '08123456789', { type: 'tel', inputMode: 'numeric' })}</Field></div>
        </div>
        {multi && <><div className="pf-sec">Kehadiran</div>
          <Field id="pf-hari" label="Batch kehadiran" req icon="calendar-event" error={fe.hari}>
            <select id="pf-hari" className={'form-select' + (fe.hari ? ' is-invalid' : '')} disabled={busy} value={f.hari || ''} onChange={e => ubah('hari', e.target.value)}>
              {f.hari === '?' && <option value="?" disabled>Pilih batch…</option>}
              <option value="1">{'Batch 1 · ' + tgl(days[0])}</option><option value="2">{'Batch 2 · ' + tgl(days[1])}</option><option value="">Kedua hari</option></select></Field></>}
        </div>
        <div className="pf-foot">
          <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={tutup}>Batal</button>
          {!edit && <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => save(null, true)}><i className="bi bi-plus-lg"/> Simpan &amp; tambah lagi</button>}
          <button className={'btn btn-primary' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={busy}>{edit ? 'Simpan perubahan' : 'Simpan peserta'}</button></div>
      </form></div>}</>
}
