import { useDialog, SkelRows, MapsWarn, Skel } from '../ui'
import { useState, useRef } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useColState, useSeminar, wait, sendTicketWA, sendTicketEmail, validEmail, useJagaProses, cariCocok, normHari } from '../hooks'; import { auth, db } from '../firebase'
// Pencarian langsung sesuai kolom tabel ini: nama, WhatsApp, email, dan status kirim (terkirim / belum)
const cocok = (p, t, q) => cariCocok(q, [p.name, p.whatsapp || 'tanpa nomor', p.waAsli, validEmail(p.email || '') ? p.email : 'tanpa email valid',
  `WhatsApp ${t.sentAt ? 'terkirim' : 'belum'}`, `Email ${t.emailSentAt ? 'terkirim' : 'belum'}`].join(' '))
export default function Distribution() {
  const ask = useDialog()
  const [ps, lp] = useColState('participants'), [ts, lt] = useColState('tickets'), loading = lp || lt, { loaded: sl, mapsOk } = useSeminar(), by = Object.fromEntries(ts.filter(t => t.status === 'aktif').map(t => [t.participantId, t]))
  const [state, setState] = useState({}), [busy, setBusy] = useState(false), [info, setInfo] = useState(''), [q, setQ] = useState(''), [grup, setGrup] = useState(''), [ukuran, setUkuran] = useState('10'), [jeda, setJeda] = useState('3'), [jedaEmail, setJedaEmail] = useState('20')
  const tampil = ps.filter(p => by[p.id] && cocok(p, by[p.id], q.trim()))
  const set = (k, v) => setState(s => ({ ...s, [k]: v })); useJagaProses(busy); const stop = useRef(false)
  const wa = async (p, t) => { const k = p.id + 'wa'; set(k, 'Mengirim…')
    try { const j = await sendTicketWA(t.id); set(k, (j.via === 'fonnte-arahan-email' ? 'Terkirim (arahan ke email)' : j.via === 'fonnte-gambar' ? 'Terkirim (gambar QR)' : `Terkirim (tautan${j.note ? '; gambar ditolak: ' + j.note : ''})`) + (j.warn ? ' - status gagal tersimpan, jangan kirim ulang' : '')); return true } catch (e) { set(k, e.message); return false } }
  const mail = async (p, t) => { const k = p.id + 'em'; set(k, 'Mengirim…')
    try { const j = await sendTicketEmail(t.id); set(k, 'Terkirim' + (j.warn ? ' - status gagal tersimpan, jangan kirim ulang' : '')); return true } catch (e) { set(k, e.message); return false } }
  // Pengiriman massal bisa dipersempit per batch dan dikirim bertahap (per kelompok dengan jeda), supaya lebih kecil kemungkinan masuk Spam.
  const inGrup = p => !grup || normHari(p.hari) === grup
  const todoWa = ps.filter(p => inGrup(p) && p.whatsapp && by[p.id] && !by[p.id].sentAt), todoEm = ps.filter(p => inGrup(p) && validEmail(p.email || '') && by[p.id] && !by[p.id].emailSentAt)
  const bulk = async (kind) => { const list = kind === 'wa' ? todoWa : todoEm, fn = kind === 'wa' ? wa : mail, nama = kind === 'wa' ? 'WhatsApp' : 'email'
    const uk = Math.floor(Number(ukuran)) > 0 ? Math.floor(Number(ukuran)) : Infinity, mnt = Math.max(0, Number(jeda) || 0), kel = Number.isFinite(uk) ? Math.ceil(list.length / uk) : 1
    const dtk = Math.max(0, Number(jedaEmail) || 0), est = Math.round((list.length * (kind === 'wa' ? 4.5 : dtk || 2) + (kel - 1) * mnt * 60) / 60)
    const tgu = async (ms, pesan) => { for (let d = Math.ceil(ms / 1000); d > 0 && !stop.current; d--) { if (pesan) setInfo(pesan(d)); await wait(1000) } }
    if (!await ask({ title: `Kirim tiket via ${nama}?`, text: `${list.length} peserta akan menerima tiket` + (kel > 1 ? `, dikirim bertahap: ${uk} peserta per kelompok, jeda ${mnt} menit antar kelompok (${kel} kelompok).` : '.') + (kind === 'wa' ? '' : ` Jeda antar email sekitar ${dtk} detik.`) + ` Perkiraan total sekitar ${est} menit. Pesan dikirim satu per satu. Jangan tutup halaman ini dan biarkan tab tetap terbuka sampai selesai. Tombol Hentikan bisa dipakai kapan saja.`, ok: 'Kirim sekarang', icon: kind === 'wa' ? 'whatsapp' : 'envelope' })) return
    setBusy(true); stop.current = false; let ok = 0, n = 0
    for (let i = 0; i < list.length && !stop.current; i++) { setInfo(`Mengirim ${nama} ${i + 1} dari ${list.length}…`); n++; if (await fn(list[i], by[list[i].id])) ok++; if (i + 1 < list.length) await tgu(kind === 'wa' ? 3000 + Math.random() * 3000 : dtk > 0 ? dtk * 1000 * (0.6 + Math.random() * 0.8) : 1500 + Math.random() * 1000, d => `${i + 1} dari ${list.length} diproses. Berikutnya dalam ${d} detik. Biarkan tab ini terbuka.`)
      if (kel > 1 && (i + 1) % uk === 0 && i + 1 < list.length) for (let d = Math.round(mnt * 60); d > 0 && !stop.current; d--) { setInfo(`${i + 1} dari ${list.length} sudah diproses. Kelompok berikutnya mulai dalam ${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}. Biarkan tab ini terbuka.`); await wait(1000) } }
    await addDoc(collection(db, 'auditLogs'), { at: serverTimestamp(), actor: auth.currentUser.email, action: `kirim ${nama} massal${stop.current ? ' (dihentikan)' : ''}`, sent: ok, failed: n - ok })
    setInfo(stop.current ? `Dihentikan (${nama}): ${ok} terkirim, ${n - ok} gagal, ${list.length - n} belum diproses. Yang belum bisa dilanjutkan dengan tombol di atas.` : `Selesai (${nama}): ${ok} terkirim, ${list.length - ok} gagal. Yang gagal tertulis di tabel dan bisa dikirim ulang.`); setBusy(false) }
  const St = ({ v, sent }) => v === 'Mengirim…' ? <Skel w="6rem" h=".9rem"/> : v ? <span className={v.startsWith('Terkirim') ? 'text-success' : 'text-danger'}>{v}</span> : sent ? <span className="text-success">Terkirim</span> : <span className="text-muted">Belum</span>
  return <><div className="d-flex gap-2 mb-3 flex-wrap"><h1 className="h4 me-auto">Distribusi tiket</h1>
    <button className={'btn btn-success btn-sm' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={busy || !todoWa.length || !mapsOk} onClick={() => bulk('wa')}><i className="bi bi-whatsapp"/>{` WhatsApp yang belum (${todoWa.length})`}</button>
    <button className={'btn btn-primary btn-sm' + (busy ? ' is-busy' : '')} aria-busy={busy} disabled={busy || !todoEm.length || !mapsOk} onClick={() => bulk('em')}><i className="bi bi-envelope"/>{` Email yang belum (${todoEm.length})`}</button></div>
    <div className="d-flex align-items-center gap-2 flex-wrap mb-2 small"><label className="text-muted" htmlFor="kirim-grup">Kirim untuk</label>
      <select id="kirim-grup" className="form-select form-select-sm" style={{ width: 'auto' }} value={grup} disabled={busy} onChange={e => setGrup(e.target.value)}><option value="">Semua peserta</option><option value="1">Batch 1 (Hari 1)</option><option value="2">Batch 2 (Hari 2)</option></select>
      <label className="text-muted ms-2" htmlFor="kirim-ukuran">Per kelompok</label><input id="kirim-ukuran" className="form-control form-control-sm" style={{ width: 80 }} type="number" min="1" inputMode="numeric" placeholder="semua" value={ukuran} disabled={busy} onChange={e => setUkuran(e.target.value)}/><span className="text-muted">peserta, jeda</span>
      <input id="kirim-jeda" aria-label="Jeda antar kelompok (menit)" className="form-control form-control-sm" style={{ width: 70 }} type="number" min="0" inputMode="numeric" value={jeda} disabled={busy} onChange={e => setJeda(e.target.value)}/><span className="text-muted">menit antar kelompok, dan</span>
      <input id="kirim-jeda-email" aria-label="Jeda antar email (detik)" className="form-control form-control-sm" style={{ width: 70 }} type="number" min="0" inputMode="numeric" value={jedaEmail} disabled={busy} onChange={e => setJedaEmail(e.target.value)}/><span className="text-muted">detik antar email</span>
      {busy && <button className="btn btn-outline-danger btn-sm ms-2" onClick={() => { stop.current = true }}>Hentikan</button>}</div>
    <p className="small text-muted mb-2">Tombol di atas hanya mengirim yang belum terkirim, sesuai pilihan ini. Kosongkan "Per kelompok" untuk tanpa jeda antar kelompok. Jeda antar email berlaku hanya untuk email dan diacak sedikit agar tidak terlalu seragam.</p>
    <p className="sub">Email membawa tiket lengkap (rincian kegiatan dan QR sebagai gambar). WhatsApp hanya memberi tahu peserta untuk membuka tiketnya di email; bila peserta tidak punya email valid, WhatsApp tetap mengirim tiket penuh. WhatsApp arahan juga menyertakan tautan untuk membuka tiket (kode QR) dan meminta peserta membalas "Hadir" sebagai konfirmasi.</p>
    <MapsWarn loaded={sl} mapsOk={mapsOk}/>
    {info && <div className="alert alert-info">{info}</div>}
    <div className="d-flex align-items-center gap-3 flex-wrap mb-2"><input className="form-control" style={{ maxWidth: 360 }} type="search" autoComplete="off" aria-label="Cari peserta" placeholder="Cari nama" value={q} onChange={e => setQ(e.target.value)}/>
      {!loading && q.trim() && <span className="small text-muted" role="status" aria-live="polite">{tampil.length} dari {Object.keys(by).length} peserta</span>}</div>
    <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Peserta</th><th>WhatsApp</th><th>Email</th><th className="text-end">Kirim ulang / kirim</th></tr></thead><tbody>
    {loading && <SkelRows rows={6} cols={4}/>}
    {!loading && tampil.map(p => { const t = by[p.id], w = state[p.id + 'wa'], m = state[p.id + 'em'], okEm = validEmail(p.email || ''); return <tr key={p.id}><td>{p.name}</td>
      <td><div className="small text-muted">{p.whatsapp || 'tanpa nomor'}</div><St v={w} sent={t.sentAt}/></td>
      <td><div className="small text-muted">{okEm ? p.email : 'tanpa email valid'}</div><St v={m} sent={t.emailSentAt}/></td>
      <td className="text-end text-nowrap"><button className={'btn btn-success btn-sm me-1' + (w === 'Mengirim…' ? ' is-busy' : '')} disabled={busy || !p.whatsapp || !mapsOk || w === 'Mengirim…'} onClick={() => wa(p, t)}><i className="bi bi-whatsapp"/> {t.sentAt ? 'Ulang' : 'Kirim'}</button>
        <button className={'btn btn-primary btn-sm' + (m === 'Mengirim…' ? ' is-busy' : '')} disabled={busy || !okEm || !mapsOk || m === 'Mengirim…'} onClick={() => mail(p, t)}><i className="bi bi-envelope"/> {t.emailSentAt ? 'Ulang' : 'Kirim'}</button></td></tr> })}
    {!loading && !ts.length && <tr><td colSpan="4" className="text-center text-muted py-4">Belum ada tiket. Buat tiket dulu di menu Tiket.</td></tr>}
    {!loading && ts.length > 0 && !tampil.length && <tr><td colSpan="4" className="text-center text-muted py-4">Tidak ada peserta yang cocok dengan “{q.trim()}”. <button className="btn btn-link btn-sm p-0 align-baseline" onClick={() => setQ('')}>Hapus pencarian</button></td></tr>}</tbody></table></div></>
}
