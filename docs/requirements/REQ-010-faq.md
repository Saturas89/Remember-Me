# Anforderung: Hilfe & FAQ

**Status:** ✔️ COMPLETED  
**ID:** REQ-010  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-12  
**Modul:** UX / Core  
**Priorität:** Low  

---

## 1. Zusammenfassung

Eine in-App FAQ-Sektion beantwortet die häufigsten Nutzerfragen zu Datenschutz, Import und Export. Sie ist von mehreren Stellen aus leicht erreichbar und benötigt keine Internetverbindung.

---

## 2. Inhalt der FAQ

Die FAQ ist in drei thematische Abschnitte unterteilt:

| Abschnitt | Themen |
|-----------|--------|
| 🔒 Datenschutz & Privatsphäre | Server-Uploads, Datenzugriff, Browser-Cache, Fotos/Audios, Spracherkennung |
| 📥 Import | Instagram-Import, Backup-Restore, fehlende Medien, Datenüberschreibung |
| 📤 Export & Backup | Exportformate, Backup vs. JSON, Geräteübertragung, Nutzung in Drittapps |

---

## 3. Funktionale Anforderungen

- **FR-10.1:** FAQ ist ohne Internetverbindung vollständig nutzbar (rein statischer Inhalt).
- **FR-10.2:** Fragen sind als Akkordeon (nativ `<details>/<summary>`) aufgeklappt/zugeklappt – eine Frage öffnet, ohne die anderen zu schließen.
- **FR-10.3:** Die FAQ ist von mindestens zwei Stellen erreichbar:
  - **Profil-Tab** → letzter Eintrag in der Liste (Karte „Hilfe & FAQ")
  - **Home-View** → kleiner `?`-Button in der oberen rechten Ecke des Headers
- **FR-10.4:** Der Zurück-Button navigiert zu der Ansicht, aus der die FAQ geöffnet wurde (Profil oder Home).
- **FR-10.5:** Neue FAQ-Einträge können ohne Code-Änderungen durch einfaches Erweitern des `SECTIONS`-Arrays hinzugefügt werden.

---

## 4. Nicht-funktionale Anforderungen

| Anforderung | Wert |
|-------------|------|
| **Offline** | 100 % – kein Netzwerk-Request |
| **Barrierefreiheit** | `<details>/<summary>` nativ zugänglich; `aria-label` auf FAQ-Button |
| **Wartbarkeit** | Inhalt in einer einzigen Datei (`FaqView.tsx`) als statisches Array |

---

## 5. Akzeptanzkriterien

- [ ] FAQ öffnet sich vom Profil-Tab aus über „Hilfe & FAQ"-Karte
- [ ] FAQ öffnet sich vom Home-Screen aus über den `?`-Button
- [ ] Zurück-Navigation führt zur jeweiligen Ausgangsansicht
- [ ] Akkordeon klappt Einträge korrekt auf/zu
- [ ] Alle drei Abschnitte (Datenschutz, Import, Export) sind vorhanden
- [ ] Seite funktioniert offline

---

## 6. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-12 | Claude | Initiale Version – Implementierung abgeschlossen |
