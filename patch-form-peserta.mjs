// Mengubah form Tambah/Ubah peserta menjadi popup berlabel (2 kolom, tidak menyempit ke samping).
// Jalankan dari folder proyek:  node patch-form-peserta.mjs
import fs from 'node:fs'

const PF = 'src/pages/Participants.jsx', CSS = 'src/styles.css'
if (!fs.existsSync(PF) || !fs.existsSync(CSS)) { console.error('Jalankan dari folder proyek (yang berisi folder src).'); process.exit(1) }
let s = fs.readFileSync(PF, 'utf8')
if (s.includes('bukaTambah')) { console.log('Perubahan sudah pernah diterapkan. Tidak ada yang diubah.'); process.exit(0) }
const gagal = []

// Ganti teks persis (harus ketemu tepat 1x)
const ganti = (nama, lama, baru) => { const n = s.split(lama).length - 1; if (n !== 1) return gagal.push(`${nama} (ketemu ${n}x)`); s = s.replace(lama, () => baru) }
// Ganti dengan pola (harus ketemu tepat 1x)
const gantiRx = (nama, rx, baru) => { const m = s.match(new RegExp(rx.source, rx.flags.replace('g', '') + 'g')); if (!m || m.length !== 1) return gagal.push(`${nama} (ketemu ${m ? m.length : 0}x)`); s = s.replace(rx, () => baru) }

ganti('import react', "import { useState } from 'react'", "import { useEffect, useState } from 'react'")

gantiRx('daftar kolom form', /^const empty = .*$/m, (m => m)(`const empty = { name:'', email:'', whatsapp:'', institution:'', bidang:'', hari:'', status:'terdaftar' }
// Kolom form: [kunci, label, contoh isian, tipe, lebar kolom di layar lebar]
const FORM = [['name', 'Nama lengkap *', 'Contoh: Budi Santoso', 'text', 12], ['whatsapp', 'Nomor WhatsApp *', 'Contoh: 08123456789', 'tel', 6], ['email', 'Email (opsional)', 'nama@perusahaan.co.id', 'text', 6],
  ['institution', 'Nama perusahaan (opsional)', 'Contoh: PT Maju Bersama', 'text', 6], ['bidang', 'Bidang perusahaan (opsional)', 'Contoh: Manufaktur', 'text', 6]]`))

ganti('state popup', '[fe, setFe] = useState({})', `[fe, setFe] = useState({}), [open, setOpen] = useState(false)
  const bukaTambah = () => { setEdit(null); setErr(''); setFe({}); setF({ ...empty, hari: multi ? '?' : '' }); setOpen(true) }   // hari '?' = belum memilih batch
  const bukaUbah = (r) => { setErr(''); setFe({}); setEdit(r.id); setF({ name: r.name, email: r.email || '', whatsapp: r.waAsli || r.whatsapp || '', institution: r.institution || '', bidang: r.bidang || '', hari: normHari(r.hari), status: r.status || 'terdaftar' }); setOpen(true) }
  const tutup = () => { setOpen(false); setEdit(null); setF(empty); setFe({}); setErr('') }
  useEffect(() => { if (!open) return; const k = (e) => e.key === 'Escape' && tutup(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [open])`)

ganti('validasi batch', "if (!d.name) er.name = 'Nama wajib diisi.'", "if (!d.name) er.name = 'Nama wajib diisi.'\n    if (multi && f.hari === '?') er.hari = 'Pilih batch peserta.'")
ganti('tutup setelah simpan', 'setF(empty); setEdit(null) } catch (ex)', 'setOpen(false); setF(empty); setEdit(null) } catch (ex)')
ganti('pesan galat halaman', '{err && <div className="alert alert-danger">{err}</div>}', '{err && !open && <div className="alert alert-danger">{err}</div>}')
ganti('tombol Tambah peserta', '<Link className="btn btn-outline-primary btn-sm" to="/admin/participants/import">Import Excel</Link>', '<button className="btn btn-primary btn-sm" onClick={bukaTambah}><i className="bi bi-plus-lg"/> Tambah peserta</button>\n    <Link className="btn btn-outline-primary btn-sm" to="/admin/participants/import">Import Excel</Link>')

// Hapus form lama yang berjajar ke samping
gantiRx('form lama', /<div className="panel"><form className="row g-2" onSubmit=\{save\}>[\s\S]*?<\/form><\/div>\n?/, '')
// Tombol Ubah membuka popup
gantiRx('tombol Ubah', /onClick=\{\(\)=>\{setEdit\(r\.id\);[\s\S]*?\}\)\}\}>Ubah/, 'onClick={() => bukaUbah(r)}>Ubah')

// Popup form baru, di akhir halaman
ganti('popup form', '</tbody></table></div></>', `</tbody></table></div>
    {open && <div className="mdl-back" onMouseDown={e => e.target === e.currentTarget && tutup()}>
      <form className="mdl mdl-form" role="dialog" aria-modal="true" aria-labelledby="pf-t" onSubmit={save} noValidate>
        <div className="d-flex align-items-center mb-3"><h2 id="pf-t" className="h5 mb-0 me-auto">{edit ? 'Ubah data peserta' : 'Tambah peserta'}</h2>
          <button type="button" className="btn-close" aria-label="Tutup" onClick={tutup}/></div>
        {err && <div className="alert alert-danger py-2 small">{err}</div>}
        <div className="row g-3">
          {FORM.map(([k, lbl, ph, tp, w]) => <div className={'col-12 col-md-' + w} key={k}>
            <label className="form-label" htmlFor={'pf-' + k}>{lbl}</label>
            <input id={'pf-' + k} className={'form-control' + (fe[k] ? ' is-invalid' : '')} placeholder={ph} value={f[k] || ''} type={tp} inputMode={tp === 'tel' ? 'numeric' : undefined} autoComplete="off" autoFocus={k === 'name'}
              onChange={e => { setF({ ...f, [k]: e.target.value }); if (fe[k]) setFe({ ...fe, [k]: '' }) }}/>
            {fe[k] && <div className="invalid-feedback">{fe[k]}</div>}</div>)}
          {multi && <div className="col-12"><label className="form-label" htmlFor="pf-hari">Batch kehadiran *</label>
            <select id="pf-hari" className={'form-select' + (fe.hari ? ' is-invalid' : '')} value={f.hari || ''} onChange={e => { setF({ ...f, hari: e.target.value }); if (fe.hari) setFe({ ...fe, hari: '' }) }}>
              {f.hari === '?' && <option value="?" disabled>Pilih batch…</option>}
              <option value="1">{'Batch 1 · ' + tgl(days[0])}</option><option value="2">{'Batch 2 · ' + tgl(days[1])}</option><option value="">Kedua hari</option></select>
            {fe.hari && <div className="invalid-feedback">{fe.hari}</div>}</div>}
        </div>
        <div className="d-flex justify-content-end gap-2 mt-4"><button type="button" className="btn btn-outline-secondary" onClick={tutup}>Batal</button>
          <button className="btn btn-primary">{edit ? 'Simpan perubahan' : 'Tambah peserta'}</button></div>
      </form></div>}</>`)

if (gagal.length) { console.error('GAGAL, tidak ada file yang diubah. Bagian yang tidak cocok:\n - ' + gagal.join('\n - ') + '\nKirim pesan ini ke Claude.'); process.exit(1) }

fs.writeFileSync(PF, s, 'utf8')
let c = fs.readFileSync(CSS, 'utf8')
if (!c.includes('.mdl-form')) fs.writeFileSync(CSS, c.replace(/\s*$/, '\n') + '/* Popup form peserta */\n.mdl.mdl-form{max-width:min(640px,100%);text-align:left}\n.mdl-form .form-label{font-size:.85rem;font-weight:600;margin-bottom:.3rem}\n', 'utf8')
console.log('Selesai: Participants.jsx dan styles.css diperbarui.')
