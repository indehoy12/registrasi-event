import { Badge } from '../ui'
import { useCol, fmt } from '../hooks'
export default function Checkins() {
  const cs = useCol('checkins', 'checkedInAt')
  return <><h1 className="h4 mb-3">Riwayat kehadiran ({cs.length})</h1><div className="table-responsive"><table className="table table-sm"><thead><tr><th>Waktu</th><th>Peserta</th><th>Hadir sebagai</th><th>Nama perwakilan</th><th>Petugas</th></tr></thead><tbody>
    {cs.map(c => <tr key={c.id}><td>{fmt(c.checkedInAt)}</td><td>{c.participantName}</td><td><Badge s={c.isRepresentative ? 'perwakilan' : 'peserta'}/></td><td>{c.representativeName || '-'}</td><td>{c.officerEmail}</td></tr>)}</tbody></table></div></>
}
