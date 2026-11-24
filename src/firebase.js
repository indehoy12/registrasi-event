import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY, authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID, storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FB_APP_ID }
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// Cache lokal (IndexedDB): kunjungan berikutnya menampilkan data tersimpan dulu, lalu otomatis disamakan dengan server.
// Bila browser tidak mendukung, otomatis memakai cache memori biasa.
let _db
try { _db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) } catch { _db = getFirestore(app) }
export const db = _db
