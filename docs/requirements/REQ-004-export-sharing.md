# Anforderung: Export & Teilen

**Status:** 🟢 DRAFT  
**ID:** REQ-004  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-10  
**Modul:** Export  
**Priorität:** Medium  

---

## 1. Zusammenfassung

Das fertige Lebensarchiv soll exportiert und mit Angehörigen geteilt werden können – als druckbares Dokument, PDF oder Link.

---

## 2. Funktionale Anforderungen

### 2.1 PDF / Druckexport

- [ ] **FR-4.1:** "Exportieren"-Button in der Archiv-Ansicht
- [ ] **FR-4.2:** Export öffnet eine druckoptimierte Ansicht (alle Antworten)
- [ ] **FR-4.3:** Druckansicht ist strukturiert nach Kategorien mit Überschriften
- [ ] **FR-4.4:** Browser-Druckdialog wird geöffnet (PDF-Speichern via Browser)

### 2.2 JSON-Backup

- [ ] **FR-4.5:** Rohdaten als `.json` herunterladen (Backup)
- [ ] **FR-4.6:** JSON-Datei kann in die App zurückimportiert werden

### 2.3 Teilen (zukünftig)

- [ ] **FR-4.7:** Generierbarer Read-Only-Link für Familienmitglieder
- [ ] **FR-4.8:** Link ist zeitlich begrenzt oder widerrufbar

---

## 3. Akzeptanzkriterien

- [ ] Klick auf "Als PDF speichern" öffnet Browser-Druckdialog mit sauberem Layout
- [ ] Exportiertes JSON enthält alle Antworten vollständig
- [ ] Importiertes JSON stellt alle Antworten korrekt wieder her

---

## 4. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-10 | Claude | Initiale Version |
