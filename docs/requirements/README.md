# Anforderungen - Remember Me

Zentrale Sammlungsstelle für alle Anforderungen des Projekts.

---

## 📋 Anforderungen Übersicht

### Neue Anforderung erstellen

1. Nutze das [REQUIREMENTS_TEMPLATE.md](./REQUIREMENTS_TEMPLATE.md)
2. Speichere unter: `[FEATURE_NAME].md`
3. Fülle alle Abschnitte aus
4. Setze Status auf 🟢 DRAFT

### Template-Struktur

```markdown
# Anforderung: [FEATURE_NAME]

**Status:** 🟢 DRAFT
**ID:** REQ-###
**Version:** 1.0.0
**Modul:** [MODUL_NAME]
**Priorität:** High / Medium / Low

## 1. Zusammenfassung
## 2. Detaillierte Beschreibung
## 3. Akzeptanzkriterien
## 4. Nicht-funktionale Anforderungen
## 5. Abhängigkeiten
## 6. Design / Mockups
## 7. Implementierungsnotizen
## 8. Testkriterien
## 9. Änderungshistorie
```

---

## 📊 Anforderungs-Status

| Status | Symbol | Bedeutung |
|--------|--------|-----------|
| Draft | 🟢 | Anforderung wird erstellt |
| Review | 🟡 | Zur Überprüfung eingereicht |
| Approved | ✅ | Genehmigt und ready zu implementieren |
| In Progress | 🔵 | Wird gerade implementiert |
| Completed | ✅ | Implementierung fertig |
| Deprecated | 🔴 | Nicht mehr relevant |

---

## 📑 Aktuelle Anforderungen

*Füge eine Tabelle mit allen Anforderungen ein:*

| ID | Titel | Modul | Priorität | Status |
|----|-------|-------|-----------|--------|
| REQ-001 | [Anforderung 1] | [Modul] | High | 🟢 DRAFT |
| REQ-002 | [Anforderung 2] | [Modul] | Medium | 🟡 REVIEW |

---

## 🎯 MoSCoW Priorisierung

### MUST (Muss)
Kritische Anforderungen, ohne die das Projekt nicht funktioniert.
- [Anforderung 1]
- [Anforderung 2]

### SHOULD (Sollte)
Wichtige Anforderungen, die das Projekt verbessern.
- [Anforderung 1]
- [Anforderung 2]

### COULD (Könnte)
Schöne Features, falls Zeit vorhanden ist.
- [Anforderung 1]
- [Anforderung 2]

### WON'T (Wird nicht)
Features, die explizit nicht implementiert werden.
- [Anforderung 1]
- [Anforderung 2]

---

## 📈 Anforderungs-Tracking

### Implementierungs-Fortschritt

```
Total: 10 Anforderungen
✅ Completed: 3
🔵 In Progress: 2
🟡 Review: 2
🟢 Draft: 3
```

---

## 🔗 Abhängigkeitsmanagement

```
REQ-001 (Anforderung 1)
  ├─ REQ-002 (muss vor REQ-001 implementiert werden)
  └─ REQ-003 (sollte vor REQ-001 implementiert werden)

REQ-002 (Anforderung 2)
  └─ REQ-004 (blockiert von)
```

---

## 📚 Best Practices

### Anforderung schreiben

✅ **DO**
- Sei spezifisch und präzise
- Verwende messbare Kriterien
- Definiere klare Akzeptanzkriterien
- Verlinke abhängige Anforderungen
- Nutze Mockups bei UI-Anforderungen

❌ **DON'T**
- Vage Formulierungen
- Zu breite Anforderungen
- Fehlende Akzeptanzkriterien
- Über-Engineering

---

## 🔄 Review-Prozess

1. **Anforderung schreiben** (Status: 🟢 DRAFT)
2. **Zur Überprüfung einreichen** (Status: 🟡 REVIEW)
3. **Feedback einarbeiten**
4. **Genehmigt** (Status: ✅ APPROVED)
5. **Zur Implementierung freigegeben**

---

## 📞 Kontakt

Bei Fragen zu Anforderungen:
- Siehe [Contributing Guide](../guides/CONTRIBUTING.md)
- Siehe [Hauptdokumentation](../README.md)

