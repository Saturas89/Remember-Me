export interface ReleaseNote {
  version: string
  date: string
  highlights: string[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '2.0.2',
    date: '2026-05-07',
    highlights: [
      '🔁 Google-Drive-Login: Nach dem Redirect zurück in die App bist du jetzt zuverlässig eingeloggt – kein Stecken bleiben mehr auf dem Anmeldebildschirm',
      '⏱ Längeres Auth-Timeout für langsame Mobilverbindungen, besonders auf iOS Safari',
    ],
  },
  {
    version: '2.0.1',
    date: '2026-05-03',
    highlights: [
      '🔐 Drive- und OneDrive-Sync sind jetzt Ende-zu-Ende-verschlüsselt – auch bei kompromittiertem Cloud-Konto bleiben deine Antworten geschützt',
      '🔑 Recovery-Code-Setup für alle Sync-Provider gleich – einmal speichern, überall wiederherstellen',
      '🛡 Sicherheits-Härtungen: schärfere Validierung beim Fragen-Import, sauberere Zufallszahlen für den Recovery-Code',
      '⚙️ Stabilitäts-Fix: Drive-Sync funktioniert jetzt auch unter strenger Content-Security-Policy',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-05-02',
    highlights: [
      '🔄 Privater Sync: Erinnerungen geräteübergreifend synchronisieren',
      '☁️ Wähle Google Drive, OneDrive oder unseren verschlüsselten Server',
      '🔐 Remember-Me-Server: Ende-zu-Ende-verschlüsselt – wir können nichts lesen',
      '✨ Geplante Features jetzt im Profil-Tab',
    ],
  },
  {
    version: '1.9.3',
    date: '2026-05-01',
    highlights: [
      '👆 Familienmodus: einmal durchwischen löscht den Kontakt sofort',
      '✨ Sanfte Fly-out-Animation beim Entfernen',
      '↩️ Kurzes Wischen bricht ohne Aktion ab',
    ],
  },
  {
    version: '1.9.2',
    date: '2026-04-29',
    highlights: [
      '👆 Familienmodus: Kontakt per Swipe-left entfernen – schnell und ohne Bestätigung',
      '↩️ Kurzes Wischen bricht ab – kein versehentliches Löschen',
    ],
  },
  {
    version: '1.9.1',
    date: '2026-04-29',
    highlights: [
      '📱 „Was ist neu?" sitzt im iOS-Standalone-Modus jetzt unter der Statusleiste',
      '← Zurück-Button statt ✕ – konsistente Navigation wie im Rest der App',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-04-28',
    highlights: [
      '🔔 Sanfte Erinnerungen: PWA-Push hält dich an deiner Geschichte dran',
      '👋 Welcome-Back-Banner für iOS, wenn du länger pausiert hast',
      '🔥 Streak-Tracking + Milestones (3, 7, 14, 30 Tage)',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-04-25',
    highlights: [
      '👨‍👩‍👧 Familienmodus: teile einzelne Erinnerungen Ende-zu-Ende-verschlüsselt mit Familie',
      '🔒 Strikt opt-in – ohne Aktivierung bleibt alles wie gewohnt offline',
      '📱 WhatsApp-fertige Share-Karte (1080×1080) für jede Einladung',
      '🌍 Familienmodus auf Deutsch und Englisch verfügbar',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-04-20',
    highlights: [
      '🇬🇧 English support – Sprache wird automatisch erkannt',
      '🌐 Sprachwechsel jederzeit im Profil möglich',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-04-20',
    highlights: [
      '🆕 Release Notes – sieh direkt im Update-Banner, was sich geändert hat',
      '📋 Versionshinweise dauerhaft im Profil abrufbar',
    ],
  },
  {
    version: '1.5.9',
    date: '2026-04-16',
    highlights: [
      '🔗 Freunde-Einladung per Share-Link – kein manueller Code mehr nötig',
      '📲 Antworten werden beim Öffnen des Links automatisch importiert',
      '✅ Kompatibel mit Web Share API (Safari, iOS, Android)',
    ],
  },
  {
    version: '1.5.8',
    date: '2026-04-12',
    highlights: [
      '🔔 Update-Banner: neue Version im Hintergrund bereit? Jetzt mit einem Klick laden',
    ],
  },
  {
    version: '1.5.6',
    date: '2026-04-12',
    highlights: [
      '💾 Export & Backup direkt aus dem Profil (Markdown, JSON, Vollbackup)',
      '♻️ Backup wiederherstellen: einfach Datei hochladen',
    ],
  },
  {
    version: '1.5.5',
    date: '2026-04-11',
    highlights: [
      '🗂 Neue Bottom-Tab-Navigation (iOS/Android-Stil, 5 Tabs)',
      '🔢 Freunde-Tab zeigt Badge für neue Antworten',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-04-11',
    highlights: [
      '📷 Foto-Anhänge zu Antworten (bis zu 5 Fotos, Lightbox-Ansicht)',
      '🤝 Themen-Auswahl für Freundes-Einladungen (4 Themen × 5 Fragen)',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-04-11',
    highlights: [
      '🤖 KI-lesbarer Export: Markdown & Enriched JSON direkt aus dem Archiv',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-04-10',
    highlights: [
      '👤 Profil-Seite mit Statistiken und bearbeitbarem Namen',
      '🖨 PDF-Export über den Browser-Druckdialog',
      '✏️ Eigene Fragen erstellen, beantworten und teilen',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-04-10',
    highlights: [
      '👥 Freunde einladen und Erinnerungen aus deren Perspektive sammeln',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-04-10',
    highlights: [
      '🚀 Remember Me gestartet – 6 Kategorien, 50+ Fragen, offline-fähig',
      '📴 Vollständig offline nutzbar (PWA)',
    ],
  },
]
