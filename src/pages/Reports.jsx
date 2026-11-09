import * as XLSX from 'xlsx'; import { useCol, fmt } from '../hooks'
export default function Reports() {
  const ps = useCol('participants'), cs = useCol('checkins'), by = Object.fromEntries(cs.map(c => [c.participantId, c]))
  const data = ps.map(p => { const c = by[p.id]; return { Nama:p.name, Instansi:p.institution, Kehadiran: c ? 'Hadir' : 'Belum hadir', 'Hadir sebagai': c ? (c.isRepresentative ? 'Perwakilan' : 'Peserta') : '', 'Nama perwakilan': c?.representativeName || '', Waktu: c ? fmt(c.checkedInAt) : '' } })
  const dl = () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Kehadiran'); XLSX.writeFile(wb, 'laporan-kehadiran.xlsx') }
  return <><h1 className="h4 mb-3">Laporan</h1><p>Terdaftar {ps.length}, hadir {cs.length}, via perwakilan {cs.filter(c => c.isRepresentative).length}.</p>
    <div className="progress mb-3" style={{height:'1.5rem',maxWidth:500}} role="progressbar" aria-label="Tingkat kehadiran"><div className="progress-bar" style={{width: ps.length ? `${Math.round(cs.length/ps.length*100)}%` : 0}}>{ps.length ? Math.round(cs.length/ps.length*100) : 0}%</div></div>
    <button className="btn btn-primary" onClick={dl}>Unduh laporan Excel</button></>
}
