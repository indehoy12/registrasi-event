import { Link } from 'react-router-dom'; import { useEffect, useState } from 'react'; import { useColState, useSeminar, fmt, hariList, hariAktif, hariLabel, ckDay, hariPeserta, totalHari } from '../hooks'; import { Empty, Skel, SkelList, MapsWarn } from '../ui'
// Jam langsung sesuai perangkat ini, diperbarui tiap detik (juga membantu memastikan jam dan zona waktu perangkat benar)
function Jam() {
  const [n, setN] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setN(new Date()), 1000); return () => clearInterval(t) }, [])
  const off = -n.getTimezoneOffset(), zona = off === 420 ? 'WIB' : off === 480 ? 'WITA' : off === 540 ? 'WIT' : 'GMT' + (off >= 0 ? '+' : '-') + Math.abs(off / 60)
  const jam = [n.getHours(), n.getMinutes(), n.getSeconds()].map(x => String(x).padStart(2, '0')).join('.')
  return <div className="dash-clock" role="timer" aria-label="Jam sekarang"><b>{jam}<span> {zona}</span></b><small>{n.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</small></div>
}
export default function Dashboard() {
  const [ps, lp] = useColState('participants'), [cs, lc] = useColState('checkins', 'checkedInAt'), loading = lp || lc
  const { sem, loaded: sl, mapsOk } = useSeminar(), days = hariList(sem), multi = days.length > 1, [pick, setPick] = useState(null), day = pick && days.includes(pick) ? pick : hariAktif(days)
  const hr = cs.filter(c => ckDay(c, days) === day), duaHari = ps.filter(p => hariPeserta(p, days).length === days.length), semuaHari = multi ? new Set(duaHari.map(p => p.id).filter(id => days.every(d => cs.some(c => c.participantId === id && ckDay(c, days) === d)))).size : 0
  const total = totalHari(ps, cs, day, days), hadir = hr.length, rep = hr.filter(c => c.isRepresentative).length, pct = total ? Math.min(100, Math.round(hadir / total * 100)) : 0   // total = peserta yang dijadwalkan pada hari terpilih (+ yang sudah dihapus tetapi pernah check-in hari itu)
  const S = ({ i, l, v, t }) => <div className="stat"><div className={`stat-ic ${t}`}><i className={`bi bi-${i}`}/></div><div><div className="stat-v">{loading ? <Skel w="3rem" h="1.6rem"/> : v}</div><div className="stat-l">{l}</div></div></div>
  return <div className="fit"><div className="dash-head"><h1 className="h4 mb-0">Dashboard</h1><Jam/></div>
    <div className="dash-bar">{multi && <div className="dash-days" role="group" aria-label="Pilih hari">{days.map(d => <button key={d} className={`btn btn-sm ${d === day ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={d === day} onClick={() => setPick(d)}>{hariLabel(days, d)}</button>)}</div>}
      <Link className="btn btn-primary dash-scan" to="/admin/scanner"><i className="bi bi-qr-code-scan"/>Mulai scan check-in</Link></div>
    <MapsWarn loaded={sl} mapsOk={mapsOk}/>
    <div className="stats mb-3"><S i="people" l="Total peserta" v={total} t="t"/><S i="person-check" l="Sudah hadir" v={hadir} t="b"/>
      <S i="person-badge" l="Lewat perwakilan" v={rep} t="a"/><S i="hourglass-split" l="Belum hadir" v={Math.max(total - hadir, 0)} t="g"/></div>
    <div className="row g-3 fit-row"><div className="col-lg-5"><div className="panel h-100 mb-0"><div className="fw-semibold">Tingkat kehadiran</div><div className="pct">{loading ? <Skel w="5rem" h="2.4rem"/> : pct + '%'}</div>
      <div className="progress" role="progressbar" aria-label="Tingkat kehadiran"><div className="progress-bar" style={{ width: `${pct}%` }}/></div>
      <small className="text-muted d-block mt-2">{loading ? <Skel w="60%" h=".8rem"/> : `${hadir} dari ${total} peserta sudah check-in${multi ? ' (' + hariLabel(days, day) + ')' : ''}`}</small>{multi && !loading && duaHari.length > 0 && <small className="text-muted d-block">Hadir di semua hari: {semuaHari} dari {duaHari.length} peserta yang dijadwalkan kedua hari</small>}</div></div>
    <div className="col-lg-7"><div className="panel h-100 mb-0 pcol"><div className="fw-semibold mb-1">Check-in terbaru</div><div className="scroll">
      {lc && <SkelList rows={5}/>}
      {!lc && hr.slice(0, 30).map(c => <div className="recent" key={c.id}><div><div>{c.participantName}</div>{c.isRepresentative && <small>Diwakili {c.representativeName}</small>}</div><small>{fmt(c.checkedInAt)}</small></div>)}
      {!lc && !hr.length && <Empty icon="qr-code-scan" text="Belum ada yang check-in."/>}</div></div></div></div></div>
}
