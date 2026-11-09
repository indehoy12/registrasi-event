import { useCol, fmt } from '../hooks'; import { Empty } from '../ui'
export default function Dashboard() {
  const ps = useCol('participants'), cs = useCol('checkins', 'checkedInAt')
  const total = ps.length, hadir = cs.length, rep = cs.filter(c => c.isRepresentative).length, pct = total ? Math.round(hadir / total * 100) : 0
  const S = ({ i, l, v, t }) => <div className="stat"><div className={`stat-ic ${t}`}><i className={`bi bi-${i}`}/></div><div><div className="stat-v">{v}</div><div className="stat-l">{l}</div></div></div>
  return <div className="fit"><h1 className="h4">Dashboard</h1><p className="sub">Ringkasan kehadiran, diperbarui langsung saat ada check-in.</p>
    <div className="stats mb-3"><S i="people" l="Total peserta" v={total} t="t"/><S i="person-check" l="Sudah hadir" v={hadir} t="b"/>
      <S i="person-badge" l="Lewat perwakilan" v={rep} t="a"/><S i="hourglass-split" l="Belum hadir" v={Math.max(total - hadir, 0)} t="g"/></div>
    <div className="row g-3 fit-row"><div className="col-lg-5"><div className="panel h-100 mb-0"><div className="fw-semibold">Tingkat kehadiran</div><div className="pct">{pct}%</div>
      <div className="progress" role="progressbar" aria-label="Tingkat kehadiran"><div className="progress-bar" style={{ width: `${pct}%` }}/></div>
      <small className="text-muted d-block mt-2">{hadir} dari {total} peserta sudah check-in</small></div></div>
    <div className="col-lg-7"><div className="panel h-100 mb-0 pcol"><div className="fw-semibold mb-1">Check-in terbaru</div><div className="scroll">
      {cs.slice(0, 30).map(c => <div className="recent" key={c.id}><div><div>{c.participantName}</div>{c.isRepresentative && <small>Diwakili {c.representativeName}</small>}</div><small>{fmt(c.checkedInAt)}</small></div>)}
      {!cs.length && <Empty icon="qr-code-scan" text="Belum ada yang check-in."/>}</div></div></div></div></div>
}
