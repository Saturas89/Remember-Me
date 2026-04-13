const KEY = 'rm-last-backup'

export function getLastBackupDate(): Date | null {
  try {
    const ts = localStorage.getItem(KEY)
    return ts ? new Date(ts) : null
  } catch { return null }
}

export function recordBackup(): void {
  try { localStorage.setItem(KEY, new Date().toISOString()) } catch { /* noop */ }
}

export function backupAgeLabel(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days === 0) return 'Heute'
  if (days === 1) return 'Gestern'
  if (days < 7)  return `vor ${days} Tagen`
  if (days < 14) return 'vor 1 Woche'
  if (days < 30) return `vor ${Math.floor(days / 7)} Wochen`
  if (days < 60) return 'vor 1 Monat'
  return `vor ${Math.floor(days / 30)} Monaten`
}

/** 'fresh' < 7 d | 'stale' 7–30 d | 'old' > 30 d | 'none' */
export function backupAgeStatus(date: Date | null): 'fresh' | 'stale' | 'old' | 'none' {
  if (!date) return 'none'
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days < 7)  return 'fresh'
  if (days < 30) return 'stale'
  return 'old'
}
