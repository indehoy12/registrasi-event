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
