import { useState } from 'react'
import { useColState, useSeminar, hariList, hariLabel, ckDay, showCode, tgl } from '../hooks'; import { Skel } from './../ui'
import { unduhLaporan, unduhCadangan } from '../excel'
export default function Reports() {
  const [ps, lp] = useColState('participants'), [cs, lc] = useColState('checkins'), [ts, lt] = useColState('tickets'), { sem } = useSeminar(), days = hariList(sem), loading = lp || lc || lt
  const [busy, setBusy] = useState(''), [err, setErr] = useState('')
  // Peserta yang sudah dihapus dari daftar tetapi pernah check-in tetap dihitung, agar angka di sini sama dengan isi file Excel
  const idPs = new Set(ps.map(p => p.id)), dihapus = new Set(cs.filter(c => !idPs.has(c.participantId)).map(c => c.participantId)).size, total = ps.length + dihapus
  const bahan = { sem, days, ps, cs, ts, hariLabel, ckDay, showCode, tgl }
  const jalankan = (nama, fn) => async () => { setErr(''); setBusy(nama); try { await fn(bahan) } catch (e) { console.error(e); setErr('Gagal membuat file Excel: ' + (e.message || e)) } setBusy('') }
  const per = (d) => { const l = cs.filter(c => ckDay(c, days) === d); return { n: l.length, rep: l.filter(c => c.isRepresentative).length, pct: total ? Math.round(l.length / total * 100) : 0 } }
  return <><h1 className="h4 mb-3">Laporan</h1>
    {loading ? <Skel w="20rem" h="1.2rem" className="mb-3"/> : <p>Terdaftar {total} peserta.</p>}
    {err && <div className="alert alert-danger">{err}</div>}
    {days.map(d => { const r = per(d); return <div key={d} className="mb-3"><div className="small fw-semibold mb-1">{hariLabel(days, d)}: hadir {loading ? '…' : r.n}, via perwakilan {loading ? '…' : r.rep}</div>
      <div className="progress" style={{ height: '1.5rem', maxWidth: 500 }} role="progressbar" aria-label={`Tingkat kehadiran ${hariLabel(days, d)}`}><div className="progress-bar" style={{ width: `${Math.min(r.pct, 100)}%` }}>{r.pct}%</div></div></div> })}
    <div className="d-flex gap-2 flex-wrap"><button className={'btn btn-primary' + (busy === 'laporan' ? ' is-busy' : '')} aria-busy={busy === 'laporan'} disabled={loading || !!busy} onClick={jalankan('laporan', unduhLaporan)}><i className="bi bi-file-earmark-excel"/> Unduh laporan Excel</button>
      <button className={'btn btn-outline-primary' + (busy === 'cadangan' ? ' is-busy' : '')} aria-busy={busy === 'cadangan'} disabled={loading || !!busy} onClick={jalankan('cadangan', unduhCadangan)}><i className="bi bi-printer"/> Unduh daftar hadir cadangan (cetak)</button></div>
    <p className="small text-muted mt-2 mb-1"><b>Laporan Excel</b> berisi tiga lembar: <b>Ringkasan</b> (rekap per hari dan per instansi), <b>Kehadiran</b> (status tiap peserta, bisa difilter), dan <b>Riwayat check-in</b> (urut waktu, lengkap dengan petugas).</p>
    <p className="small text-muted">Daftar cadangan berisi nama, nomor tiket, dan kolom paraf. Cetak atau simpan di HP panitia sebelum hari H, jaga-jaga bila internet di lokasi bermasalah.</p></>
}
