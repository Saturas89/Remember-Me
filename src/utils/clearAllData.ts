// DSGVO Art. 17 – vollständige lokale Datenlöschung.
//
// Löscht in dieser Reihenfolge:
//   1. Alle IndexedDB-Datenbanken des App-Namensraums
//   2. Alle localStorage-Einträge
//
// Cloud-Daten (Supabase-Sync-Zeile, Auth-Session) müssen vor dem Aufruf
// dieser Funktion über privateSync.deactivate(true) gelöscht werden.
// Die Funktion selbst kümmert sich nur um lokale Daten, damit sie auch ohne
// eine aktive Supabase-Session funktioniert.
//
// Nach dem Aufruf ist die App in einem frischen Zustand – Aufrufer sollten
// window.location.reload() ausführen, um React-State zu resetten.

const IDB_DATABASES = [
  'rm-images',
  'rm-audio',
  'rm-videos',
  'rm-share-log',
  'rm-sync-auth',
  'rm-device-key',
  'rm-state-key',
]

function deleteIDB(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()   // best-effort: resolve even on error
    req.onblocked = () => resolve() // another tab holds the DB open – proceed anyway
  })
}

export async function clearAllData(): Promise<void> {
  await Promise.all(IDB_DATABASES.map(deleteIDB))
  localStorage.clear()
}
