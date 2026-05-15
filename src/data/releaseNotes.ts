export interface ReleaseNote {
  version: string
  date: string
  highlights: string[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '2.10.0',
    date: '2026-05-15',
    highlights: [
      '📊 Wir tracken jetzt, wie Features genutzt werden – anonym, ohne Cookies, auf EU-Servern.',
      '🔒 Kein Fingerprinting, kein Autocapture – nur was wirklich zählt.',
    ],
  },
  {
    version: '2.9.0',
    date: '2026-05-14',
    highlights: [
      '🔓 Im Impressum siehst du jetzt: Storyhold ist Open Source (AGPL-3.0).',
      '🇩🇪 Und: Made in Germany – die App wird in Deutschland entwickelt.',
      '🤝 Zwei kleine Pills, ein klares Vertrauenssignal.',
    ],
  },
  {
    version: '2.8.0',
    date: '2026-05-14',
    highlights: [
      '💬 Neuer Eintrag im Profil: „Wie gefällt dir die App?" – Smiley antippen, fertig.',
      '✍️ Wenn du magst, kannst du danach einen kurzen Kommentar dazulegen.',
      '🔒 Dein Name wird nirgends gespeichert – wir wissen nur, dass jemand getippt hat.',
    ],
  },
  {
    version: '2.7.0',
    date: '2026-05-12',
    highlights: [
      '💬 Stell deine eigenen Fragen – in deinen Worten, an Mama, Papa, Oma.',
      '💞 Auch die Fragen, die zwischen euch liegen.',
      '🌍 Komplett auf Deutsch und Englisch verfügbar.',
    ],
  },
  {
    version: '2.6.0',
    date: '2026-05-11',
    highlights: [
      '✉️ Sync-Setup zeigt jetzt deutlich an, wenn auf deinen Klick im Bestätigungs-E-Mail-Link gewartet wird – inklusive deiner Adresse',
      '🔁 Neuer „Bestätigungs-Mail erneut senden"-Button für den Fall, dass die erste Mail nicht ankommt',
      '⚡ Nach dem Klick auf den Link geht es automatisch weiter – kein erneutes Tippen mehr nötig',
    ],
  },
  {
    version: '2.5.0',
    date: '2026-05-10',
    highlights: [
      '📄 Neue Impressum-Seite im Profil – rechtssichere Anbieterkennzeichnung nach § 5 DDG',
      '⚖️ Verantwortlicher i. S. d. § 18 MStV, Hinweis zur EU-Streitbeilegung und Haftungs-/Urheberrechtsklauseln',
      '🎨 Look passt sich dem Freunde-Tab an und funktioniert in allen vier Themes',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-05-09',
    highlights: [
      '🪶 Neuer „Einfach"-Modus mit großen Knöpfen, größerer Schrift und nur den wichtigsten Funktionen – ideal zum Verschenken',
      '⚙️ Beim allerersten Start fragt die App jetzt: „Wie möchten Sie sie nutzen?" – „Einfach" oder „Vollständig"',
      '🔁 Jederzeit umschaltbar im Profil unter „Bedienung" – nichts geht verloren beim Wechsel',
      '🎙 Sprachaufnahme bleibt auch im Einfach-Modus aktiv – einfach drauf-tippen und losreden',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-05-09',
    highlights: [
      '🔑 Neue Option „Schlüssel verloren?" im Sync-Login – starte mit einem frischen Sicherheitsschlüssel neu, ohne lokale Daten zu verlieren',
    ],
  },
  {
    version: '2.1.1',
    date: '2026-05-08',
    highlights: [
      '🔑 Google-Drive-Sync: Bei abgelaufenem Token erscheint jetzt direkt im Sync-Tab ein „Erneut anmelden"-Button – kein Umweg mehr über Sync deaktivieren und neu einrichten',
      '🔄 Nach der erneuten Google-Anmeldung übernimmt der Sync-Tab den frischen Token automatisch und startet sofort eine Synchronisation',
      '⏹️ Auth-Fehler lösen kein sinnloses Wiederholen mehr aus – die App wartet auf deine Aktion, statt im Hintergrund weiterzuversuchen',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-05-08',
    highlights: [
      '🎨 Sync-Tab im Look des Freunde-Tabs: klare Sektionen, Tag-Chips und ein leuchtender „Jetzt synchronisieren"-Button',
      '🗂️ „Speicherort"-Karten zeigen Provider und Inhalt jetzt sauber getrennt – kein zusammengelaufener Text mehr',
      '🛑 Neuer Hinweis im Sync-Tab erklärt vor dem Klick, dass „Sync deaktivieren" deine Cloud-Datei nur auf Wunsch mitlöscht',
    ],
  },
  {
    version: '2.0.3',
    date: '2026-05-08',
    highlights: [
      '☁️ Google-Drive-Sync: kein „Drive-Upload fehlgeschlagen: 404" mehr nach erneutem Anmelden – die App legt verlorene Sync-Dateien automatisch neu an',
      '🧹 „Sync deaktivieren" räumt jetzt auch den lokalen Datei-Verweis auf, damit der nächste Login sauber startet',
    ],
  },
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
      '🚀 Storyhold gestartet – 6 Kategorien, 50+ Fragen, offline-fähig',
      '📴 Vollständig offline nutzbar (PWA)',
    ],
  },
]
