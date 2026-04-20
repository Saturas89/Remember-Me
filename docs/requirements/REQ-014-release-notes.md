# Anforderung: Release Notes / „Was ist neu?"

**Status:** ✔️ COMPLETED  
**ID:** REQ-014  
**Version:** 1.6.0  
**Letzte Aktualisierung:** 2026-04-20  
**Modul:** UX  
**Priorität:** Low  

---

## 1. Zusammenfassung

Nutzer sollen direkt in der App einsehen können, was sich in der jeweils aktuellen Version geändert hat. Die Versionshistorie ist über zwei Einstiegspunkte erreichbar: optional im Update-Banner (wenn ein Service-Worker-Update vorliegt) und dauerhaft im Profil-Tab.

---

## 2. Einstiegspunkte

| Einstiegspunkt | Bedingung | Verhalten |
|----------------|-----------|-----------|
| **Update-Banner** | Wenn ein SW-Update bereit steht | Neuer „Was ist neu?"-Button neben „Neu laden"; öffnet Modal ohne zu erzwingen |
| **Profil-Tab** | Immer sichtbar | Karte „Was ist neu?" unterhalb von „Hilfe & FAQ"; öffnet dasselbe Modal |

---

## 3. Funktionale Anforderungen

- **FR-14.1:** Das Release-Notes-Modal zeigt alle Versionen von aktuell bis v1.0.0, neueste zuerst.
- **FR-14.2:** Die aktuelle Version ist visuell hervorgehoben (z. B. akzentfarbener Hintergrund).
- **FR-14.3:** Jeder Versionseintrag enthält: Versionsnummer, Datum und eine kurze Bullet-Liste nutzerseitiger Highlights (kein technischer Jargon).
- **FR-14.4:** Das Modal schließt sich über einen ✕-Button; kein Routing-Wechsel nötig.
- **FR-14.5:** Der „Was ist neu?"-Button im UpdateBanner ist optional (`onViewNotes?: () => void`) – der Banner bleibt rückwärtskompatibel ohne ihn.
- **FR-14.6:** Release Notes sind vollständig offline verfügbar (statische Daten, kein API-Call).
- **FR-14.7:** Neue Versionen können durch einfaches Voranstellen eines Eintrags in `src/data/releaseNotes.ts` veröffentlicht werden.

---

## 4. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| **Offline** | 100 % – rein statische Datei, kein Netzwerk-Request |
| **Barrierefreiheit** | `role="dialog"`, `aria-modal="true"`, `aria-label` auf Modal und Close-Button |
| **Lokalisierung** | Translations-Block `releaseNotes` in `de/ui.ts` und `en/ui.ts` (Labels, nicht Inhalte) |
| **Rückwärtskompatibilität** | UpdateBanner-Prop `onViewNotes` optional; bestehende Render-Pfade unverändert |

---

## 5. Datenschicht

```
src/data/releaseNotes.ts
└── RELEASE_NOTES: ReleaseNote[]
    └── ReleaseNote: { version, date, highlights: string[] }
```

Inhalt: kurze, emoji-annotierte Beschreibungen pro Version. Keine personenbezogenen Daten.

---

## 6. Akzeptanzkriterien

- [x] Profil-Tab zeigt die Karte „Was ist neu?" sichtbar an
- [x] Klick auf die Karte öffnet das Release-Notes-Modal
- [x] Modal zeigt mindestens die aktuelle Version (1.6.0) mit Highlights
- [x] Modal schließt sich über den ✕-Button
- [x] Update-Banner enthält bei gesetztem `onViewNotes` den Button „Was ist neu?"
- [x] Klick auf „Was ist neu?" im Banner öffnet das Modal (kein automatisches Neu-Laden)
- [x] Feature funktioniert vollständig offline
- [x] E2E-Tests in `e2e/release-notes.spec.ts` sind grün (alle 5 Browser-Projekte)
