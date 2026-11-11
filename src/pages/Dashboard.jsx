import { Link } from 'react-router-dom'; import { useState } from 'react'; import { useColState, useSeminar, fmt, hariList, hariAktif, hariLabel, ckDay } from '../hooks'; import { Empty, Skel, SkelList, MapsWarn } from '../ui'
export default function Dashboard() {
  const [ps, lp] = useColState('participants'), [cs, lc] = useColState('checkins', 'checkedInAt'), loading = lp || lc
  const { sem, loaded: sl, mapsOk } = useSeminar(), days = hariList(sem), multi = days.length > 1, [pick, setPick] = useState(null), day = pick && days.includes(pick) ? pick : hariAktif(days)
  const hr = cs.filter(c => ckDay(c, days) === day), semuaHari = multi ? new Set(ps.map(p => p.id).filter(id => days.every(d => cs.some(c => c.participantId === id && ckDay(c, days) === d)))).size : 0
  const dihapus = new Set(cs.filter(c => !ps.some(p => p.id === c.participantId)).map(c => c.participantId)).size   // sudah check-in lalu dihapus dari daftar
  const total = ps.length + dihapus, hadir = hr.length, rep = hr.filter(c => c.isRepresentative).length, pct = total ? Math.round(hadir / total * 100) : 0
  const S = ({ i, l, v, t }) => <div className="stat"><div className={`stat-ic ${t}`}><i className={`bi bi-${i}`}/></div><div><div className="stat-v">{loading ? <Skel w="3rem" h="1.6rem"/> : v}</div><div className="stat-l">{l}</div></div></div>
  return <div className="fit"><div className="d-flex gap-2 flex-wrap align-items-start"><div className="me-auto"><h1 className="h4">Dashboard</h1><p className="sub">Ringkasan kehadiran, diperbarui langsung saat ada check-in.</p></div><Link className="btn btn-primary" to="/admin/scanner"><i className="bi bi-qr-code-scan"/>Mulai scan check-in</Link></div>
    <MapsWarn loaded={sl} mapsOk={mapsOk}/>
    {multi && <div className="d-flex gap-2 flex-wrap mb-3">{days.map(d => <button key={d} className={`btn btn-sm ${d === day ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setPick(d)}>{hariLabel(days, d)}</button>)}</div>}
    <div className="stats mb-3"><S i="people" l="Total peserta" v={total} t="t"/><S i="person-check" l="Sudah hadir" v={hadir} t="b"/>
      <S i="person-badge" l="Lewat perwakilan" v={rep} t="a"/><S i="hourglass-split" l="Belum hadir" v={Math.max(total - hadir, 0)} t="g"/></div>
    <div className="row g-3 fit-row"><div className="col-lg-5"><div className="panel h-100 mb-0"><div className="fw-semibold">Tingkat kehadiran</div><div className="pct">{loading ? <Skel w="5rem" h="2.4rem"/> : pct + '%'}</div>
      <div className="progress" role="progressbar" aria-label="Tingkat kehadiran"><div className="progress-bar" style={{ width: `${pct}%` }}/></div>
      <small className="text-muted d-block mt-2">{loading ? <Skel w="60%" h=".8rem"/> : `${hadir} dari ${total} peserta sudah check-in${multi ? ' (' + hariLabel(days, day) + ')' : ''}`}</small>{multi && !loading && <small className="text-muted d-block">Hadir di semua hari: {semuaHari} peserta</small>}</div></div>
    <div className="col-lg-7"><div className="panel h-100 mb-0 pcol"><div className="fw-semibold mb-1">Check-in terbaru</div><div className="scroll">
      {lc && <SkelList rows={5}/>}
      {!lc && hr.slice(0, 30).map(c => <div className="recent" key={c.id}><div><div>{c.participantName}</div>{c.isRepresentative && <small>Diwakili {c.representativeName}</small>}</div><small>{fmt(c.checkedInAt)}</small></div>)}
      {!lc && !hr.length && <Empty icon="qr-code-scan" text="Belum ada yang check-in."/>}</div></div></div></div></div>
}
