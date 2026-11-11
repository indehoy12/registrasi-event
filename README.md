# Registrasi dan Kehadiran Seminar (paket gratis Firebase Spark)

1. `npm install`, salin `.env.example` menjadi `.env`, isi konfigurasi Firebase.
2. Firebase Console: aktifkan Authentication (Email/Password) dan Firestore (lokasi Jakarta).
3. Firestore, tab Rules: tempel isi `firestore.rules`, lalu Publish.
4. Buat akun Super Admin pertama (Authentication, Users, Add user), lalu di Firestore buat koleksi `users` dengan Document ID = User UID dan field `email` (string), `role` = `superadmin` (string), `active` = true (boolean).
5. `npm run dev`, buka /admin/login.
6. Online: `npm run build`, seret folder `dist` ke app.netlify.com/drop, lalu tambahkan domain Netlify di Authentication, Settings, Authorized domains.

## WhatsApp via Fonnte
Pengiriman memakai Netlify Function `netlify/functions/send-wa.mjs`. Isi environment variable di Netlify: `FONNTE_TOKEN`, `FB_API_KEY`, `FB_PROJECT_ID`, `SITE_URL`. Function hanya bisa dideploy lewat Git atau Netlify CLI (bukan drag-and-drop): `netlify deploy --prod --build`. Uji lokal dengan `netlify dev`.

## Pengiriman otomatis tiket (Fonnte)
- Menu Tiket: centang "Kirim otomatis via WhatsApp", lalu klik "Buat tiket". Setiap tiket baru langsung dikirim ke WhatsApp peserta (jeda 3-6 detik per pesan).
- Pesan berisi nama, judul, tanggal, waktu, tempat, gambar QR (`/qr/<kode>.png`), dan tautan tiket cadangan.
- Lampiran gambar hanya diterima Fonnte pada paket Super/Advanced/Ultra. Di paket lain, sistem otomatis mengirim pesan teks + tautan tiket.
- Yang gagal terkirim tetap berstatus "Belum" di menu Distribusi dan bisa dikirim ulang.

## Titik lokasi (Google Maps)
- Menu **Info seminar**: cari nama tempat, pakai "Lokasi saya", sentuh peta, atau geser pin. Tautan Google Maps terisi otomatis dan wajib ada sebelum tiket dibuat/dikirim.
- Peta memakai Leaflet + OpenStreetMap, pencarian tempat memakai Nominatim (cukup untuk pemakaian admin yang ringan).
- Tautan pendek (maps.app.goo.gl) tetap bisa ditempel; pin di peta dihapus karena koordinatnya tidak bisa dibaca.
- Titik dikirim di pesan WhatsApp dan tampil di tiket peserta (peta mini + tombol Google Maps).
- Setelah `npm install`, pastikan paket `leaflet` terpasang (sudah ada di package.json).

## Kegiatan 2 hari
- Menu **Info seminar**: isi **Tanggal (hari ke-1)** dan **Tanggal hari ke-2** (kosongkan bila hanya 1 hari).
- Satu tiket QR dipakai di kedua hari. Check-in dicatat per hari; QR yang sama ditolak bila dipindai dua kali pada hari yang sama, dan valid lagi di hari berikutnya.
- Halaman scan memilih hari otomatis sesuai tanggal hari ini (bisa diganti manual). Dashboard, Riwayat, dan Laporan Excel memisahkan data per hari.
- Data check-in lama tanpa catatan hari dianggap hari ke-1.

## Email tiket (Gmail)
Isi email sama dengan pesan WhatsApp; QR dilampirkan sebagai gambar. Dikirim lewat `netlify/functions/send-email.mjs` memakai SMTP Gmail.
1. Siapkan satu akun Gmail khusus panitia (bukan akun pribadi).
2. Aktifkan **Verifikasi 2 langkah** di akun itu, lalu buat **Sandi aplikasi** (myaccount.google.com/apppasswords). Hasilnya 16 karakter.
3. Di Netlify > Site configuration > Environment variables isi `GMAIL_USER` (alamat Gmail), `GMAIL_APP_PASSWORD` (sandi aplikasi, bukan sandi akun), dan opsional `MAIL_FROM_NAME`.
4. Deploy ulang. Coba kirim dulu ke 2 sampai 3 email panitia di menu **Distribusi**.
- Gmail membatasi jumlah email per hari untuk akun biasa; untuk 100 peserta aman, tetapi jangan mengirim berulang-ulang.
- Minta peserta mengecek folder spam dan menyimpan kontak pengirim.


## Persiapan hari H (sangat disarankan)
1. **Publish ulang `firestore.rules`** (Firebase Console, Firestore, Rules). Aturan check-in diperketat: catatan kehadiran hanya sah bila dibuat bersamaan dengan penandaan tiketnya.
2. **Isi tanggal seminar lebih dulu** di menu Info seminar. Check-in dinonaktifkan selama tanggal kosong, dan tanggal tidak bisa digeser setelah ada check-in pada tanggal lama.
3. **Cadangan bila internet bermasalah:** menu Laporan, tombol *Unduh daftar hadir cadangan (cetak)*. Cetak atau simpan di HP panitia. Aplikasi ini butuh internet untuk check-in; tidak ada mode offline.
4. **Uji sinyal di lokasi** dengan 2 sampai 3 HP petugas, dan siapkan hotspot cadangan.
5. **Uji kirim** ke 2 sampai 3 nomor/email panitia sebelum kirim massal. Kirim bertahap, jangan sekaligus dari nomor yang baru dipakai (Fonnte bukan WhatsApp Business API resmi).
6. **Saat kirim massal**, biarkan tab tetap terbuka dan jangan biarkan laptop tidur. Pengiriman berjalan dari browser; bila tab ditutup, proses berhenti dan sisanya bisa dilanjutkan dari menu Distribusi.
7. **Uji check-in** dengan tiket panitia lebih dulu setelah tanggal diisi, lalu batalkan di Riwayat kehadiran sebelum acara.

## Catatan perilaku data
- Menghapus peserta otomatis mencabut tiketnya. Riwayat check-in yang sudah ada tetap tersimpan dan tetap tampil di laporan.
- Mengubah nama/instansi peserta ikut memperbarui tiketnya. Bila WhatsApp atau email diubah, status kirim direset ke "Belum" di menu Distribusi agar tiket bisa dikirim ke kontak baru.

## Laporan Excel
Menu **Laporan** menghasilkan file Excel tiga lembar (dibuat dengan ExcelJS, dimuat hanya saat tombol ditekan):
- **Ringkasan**: rekap per hari dan per instansi. Angkanya berupa rumus yang mengacu ke lembar Kehadiran, jadi ikut berubah bila data di sana diedit.
- **Kehadiran**: satu baris per peserta, status berwarna (hadir/belum/perwakilan), kolom dibekukan dan bisa difilter. Peserta yang sudah dihapus tetapi pernah check-in ditandai "(peserta sudah dihapus)".
- **Riwayat check-in**: urut waktu, lengkap dengan cara (QR/manual) dan petugas.
Tampilan polos: latar putih tanpa warna, status dibedakan lewat huruf tebal/miring. Semua lembar sudah diatur untuk dicetak (A4, lebar muat satu halaman, judul kolom berulang di tiap halaman).
