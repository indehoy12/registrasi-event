import { useState } from 'react'
import { useColState, useSeminar, hariList, hariLabel, ckDay, showCode, tgl, hariBoleh, totalHari } from '../hooks'; import { Skel } from './../ui'
import { unduhLaporan, unduhLaporanHari, unduhCadangan } from '../excel'
export default function Reports() {
  const [ps, lp] = useColState('participants'), [cs, lc] = useColState('checkins'), [ts, lt] = useColState('tickets'), { sem } = useSeminar(), days = hariList(sem), loading = lp || lc || lt
  const [busy, setBusy] = useState(''), [err, setErr] = useState('')
  // Peserta yang sudah dihapus dari daftar tetapi pernah check-in tetap dihitung, agar angka di sini sama dengan isi file Excel
  const idPs = new Set(ps.map(p => p.id)), dihapus = new Set(cs.filter(c => !idPs.has(c.participantId)).map(c => c.participantId)).size, total = ps.length + dihapus
  const bahan = { sem, days, ps, cs, ts, hariLabel, ckDay, showCode, tgl, hariBoleh }
  const jalankan = (nama, fn) => async () => { setErr(''); setBusy(nama); try { await fn(bahan) } catch (e) { console.error(e); setErr('Gagal membuat file Excel: ' + (e.message || e)) } setBusy('') }
  const per = (d) => { const l = cs.filter(c => ckDay(c, days) === d), tot = totalHari(ps, cs, d, days); return { n: l.length, tot, rep: l.filter(c => c.isRepresentative).length, pct: tot ? Math.round(l.length / tot * 100) : 0 } }
  return <><h1 className="h4 mb-3">Laporan</h1>
    {loading ? <Skel w="20rem" h="1.2rem" className="mb-3"/> : <p>Terdaftar {total} peserta{days.length > 1 ? ` (${days.map(d => `${hariLabel(days, d)}: ${totalHari(ps, cs, d, days)}`).join(', ')}; yang hadir kedua hari terhitung di keduanya)` : ''}.</p>}
    {err && <div className="alert alert-danger">{err}</div>}
    {days.map(d => { const r = per(d); return <div key={d} className="mb-3"><div className="small fw-semibold mb-1">{hariLabel(days, d)}: hadir {loading ? '…' : r.n}{days.length > 1 && !loading ? ` dari ${r.tot}` : ''}, via perwakilan {loading ? '…' : r.rep}</div>
      <div className="progress" style={{ height: '1.5rem', maxWidth: 500 }} role="progressbar" aria-label={`Tingkat kehadiran ${hariLabel(days, d)}`}><div className="progress-bar" style={{ width: `${Math.min(r.pct, 100)}%` }}>{r.pct}%</div></div></div> })}
    <div className="d-flex gap-2 flex-wrap"><button className={'btn btn-primary' + (busy === 'laporan' ? ' is-busy' : '')} aria-busy={busy === 'laporan'} disabled={loading || !!busy} onClick={jalankan('laporan', unduhLaporan)}><i className="bi bi-file-earmark-excel"/> Unduh laporan Excel</button>
      {days.length > 1 && days.map(d => { const k = 'hari-' + d; return <button key={d} className={'btn btn-outline-primary' + (busy === k ? ' is-busy' : '')} aria-busy={busy === k} disabled={loading || !!busy} onClick={jalankan(k, (b) => unduhLaporanHari({ ...b, hari: d }))}><i className="bi bi-calendar-day"/> Unduh laporan {hariLabel(days, d)}</button> })}
      <button className={'btn btn-outline-primary' + (busy === 'cadangan' ? ' is-busy' : '')} aria-busy={busy === 'cadangan'} disabled={loading || !!busy} onClick={jalankan('cadangan', unduhCadangan)}><i className="bi bi-printer"/> Unduh daftar hadir cadangan (cetak)</button></div>
    <p className="small text-muted mt-2 mb-1"><b>Laporan Excel</b> berisi lembar <b>Ringkasan</b> (rekap per hari dan per instansi), <b>Kehadiran</b> (status tiap peserta di semua hari, bisa difilter){days.length > 1 ? <>, <b>satu lembar per hari</b> (hanya peserta hari itu), </> : ', '}dan <b>Riwayat check-in</b> (urut waktu, lengkap dengan petugas).{days.length > 1 && ' Tombol "Unduh laporan Hari …" membuat file terpisah yang hanya berisi satu hari.'}</p>
    <p className="small text-muted">Daftar cadangan berisi nama, nomor tiket, dan kolom paraf. Cetak atau simpan di HP panitia sebelum hari H, jaga-jaga bila internet di lokasi bermasalah.</p></>
}
