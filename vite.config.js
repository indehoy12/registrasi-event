import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react'
// Library besar dipisah jadi berkas sendiri: browser menyimpannya lama (tidak diunduh ulang tiap kali kode aplikasi berubah)
// dan bisa diunduh paralel.
export default defineConfig({ plugins: [react()], build: { target: 'es2020', cssCodeSplit: true, chunkSizeWarningLimit: 700,
  rollupOptions: { output: { manualChunks(id) {
    if (!id.includes('node_modules')) return
    if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@remix-run)\//.test(id)) return 'react'
    if (/node_modules\/(@firebase|firebase)\//.test(id)) return 'firebase'
  } } } } })
