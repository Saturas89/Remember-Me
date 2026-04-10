# Projektübersicht - Remember Me

**Status:** 🔵 IN PROGRESS  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-10

---

## Projektbeschreibung

**Remember Me** ist eine Progressive Web App (PWA), mit der Menschen ihre Lebensgeschichte, persönlichen Erinnerungen, Werte und Erfahrungen spielerisch für die Nachwelt festhalten können.

Die Idee: Viele Menschen möchten ihren Kindern, Enkeln und Angehörigen mehr hinterlassen als nur Fotos – echte Geschichten, Werte, Ratschläge, Kindheitserinnerungen. **Remember Me** führt sie durch gezielte Fragen in Lebenskategorien und macht daraus ein persönliches, bleibendes Dokument.

Die App ist vollständig responsiv und funktioniert nahtlos auf:
- 📱 Mobilgeräten (touch-optimiert, ideal für unterwegs)
- 💻 Desktop/Tablet (für längere Antworten)
- 📴 Offline (mit Service Workers – keine ständige Internetverbindung nötig)

---

## Kernkonzept

```
Benutzer öffnet App
      ↓
Wählt Kategorie (z.B. "Kindheit")
      ↓
Beantwortet Fragen spielerisch (Text, Auswahl, Medien)
      ↓
Antworten werden lokal gespeichert
      ↓
Lebensarchiv wächst mit der Zeit
      ↓
Teilen / Exportieren für Angehörige
```

---

## Projektziele

- [x] Progressive Web App (PWA) Grundstruktur
- [x] Vite + React + TypeScript Setup
- [x] Vercel Deployment
- [ ] Frage-Engine mit Kategorien
- [ ] Lokale Datenspeicherung (localStorage / IndexedDB)
- [ ] Vollständiger Fragenkatalog (alle Kategorien)
- [ ] Antwort-Übersicht / Lebensarchiv-Ansicht
- [ ] Export als druckbares Dokument / PDF
- [ ] Optionale Freigabe-Links für Familienmitglieder
- [ ] Medienanhänge (Fotos zu Antworten)
- [ ] Push Notifications (Erinnerung zum Weitermachen)

---

## Fragenkategorien

| Kategorie | Beschreibung | Beispielfragen |
|-----------|-------------|----------------|
| **Kindheit & Jugend** | Frühe Erinnerungen, Heimat, Schule | "Wo bist du aufgewachsen?" |
| **Familie & Beziehungen** | Eltern, Geschwister, Partnerschaft | "Wie haben sich deine Eltern kennengelernt?" |
| **Beruf & Leidenschaften** | Karriere, Hobbies, Talente | "Was war dein erster Job?" |
| **Werte & Überzeugungen** | Lebensprinzipien, Glaube, Ansichten | "Was sind deine drei wichtigsten Werte?" |
| **Erinnerungen & Erlebnisse** | Schlüsselmomente, Reisen, Abenteuer | "Dein schönster Urlaub?" |
| **Wünsche & Vermächtnis** | Ratschläge, Träume, letzte Worte | "Was möchtest du deinen Enkeln mitgeben?" |

---

## Glossar

| Begriff | Beschreibung |
|---------|-------------|
| PWA | Progressive Web App – Web-App mit nativen App-Features (offline, installierbar) |
| Frage-Engine | System zur Präsentation und Verwaltung von Fragen |
| Lebensarchiv | Sammlung aller gespeicherten Antworten eines Benutzers |
| Kategorie | Thematische Gruppe von Fragen (z.B. "Kindheit") |
| Kapitel | Abgeschlossene Kategorie mit allen beantworteten Fragen |
| Eintrag | Eine beantwortete Frage mit Datum und ggf. Medien |
| Export | Ausgabe des Lebensarchivs als PDF oder druckbares Dokument |
| Service Worker | JS-Worker für Offline-Funktionalität und Caching |

---

## Key Stakeholder

- **Projekt Owner:** Saturas89
- **Lead Developer:** Claude Code
- **Target Users:** Menschen aller Altersgruppen, besonders 40+

---

## Kontakt

- **Dokumentation:** Siehe [`/docs`](.)
- **Anforderungen:** Siehe [`/docs/requirements`](./requirements/)
