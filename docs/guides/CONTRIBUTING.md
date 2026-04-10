# Contribution Guide - Simple Workout

Danke dass du zu diesem Projekt beitragen möchtest! Diese Richtlinien helfen uns, einen konsistenten und hochwertigen Kodex zu pflegen.

---

## 1. Arbeitsablauf

### 1.1 Neue Anforderung definieren

1. Gehe zu `/docs/requirements/`
2. Erstelle eine neue Datei: `[FEATURE_NAME].md`
3. Nutze das Template aus `REQUIREMENTS_TEMPLATE.md`
4. Fülle alle Abschnitte aus

### 1.2 Modul erstellen

1. Gehe zu `/docs/modules/`
2. Erstelle einen neuen Ordner: `[MODUL_NAME]/`
3. Kopiere die Template-Dateien aus `MODULE_TEMPLATE/`
4. Passe alle Dateien an:
   - `README.md`
   - `SPECIFICATION.md`
   - `REQUIREMENTS.md`
   - `ARCHITECTURE.md`
   - `CHANGELOG.md`

### 1.3 Branch-Strategie

```
main (produktiv)
  ↓
feature/[feature-name]  (neue Features)
docs/[doc-name]         (Dokumentation)
fix/[bug-name]          (Bugfixes)
```

**Regel:** Nie direkt auf `main` arbeiten!

### 1.4 Commit-Nachrichten

Format:
```
[TYPE]: [SHORT DESCRIPTION]

[OPTIONAL LONG DESCRIPTION]

[REFERENCES]
```

Types:
- `feat:` Neue Funktion
- `fix:` Bugfix
- `docs:` Dokumentation
- `style:` Formatierung
- `refactor:` Umstrukturierung
- `test:` Tests
- `chore:` Wartung

Beispiel:
```
docs: Add requirements template

Create comprehensive template for defining requirements
with all necessary sections and examples.

Closes: #123
```

---

## 2. Dokumentations-Standards

### 2.1 Markdown-Stil

- Verwende Markdown für alle Dokumente
- Nutze Überschriften korrekt (H1 > H2 > H3)
- Setze Code in Backticks oder Code-Blöcken
- Verwende Listen für Aufzählungen

### 2.2 Versionierung

Alle Dokumente müssen folgende Kopfzeile haben:

```markdown
# [TITEL]

**Status:** 🟢 DRAFT / 🟡 REVIEW / 🟢 APPROVED / 🔴 DEPRECATED  
**Version:** 1.0.0  
**Letzte Aktualisierung:** YYYY-MM-DD
```

### 2.3 Aktualisierungsrichtlinien

1. **DRAFT** → **REVIEW:** Wenn Dokument fertig ist
2. **REVIEW** → **APPROVED:** Nach Überprüfung
3. **APPROVED** → **DEPRECATED:** Wenn nicht mehr gültig

---

## 3. Code-Standards

### 3.1 Dateinamen

- Module: `kebab-case` (z.B. `user-service`)
- Komponenten: `PascalCase` (z.B. `UserProfile`)
- Dateitypen: `index.ts`, `*.spec.ts`, `*.test.ts`

### 3.2 Struktur

```
src/
├── modules/
│   ├── [module-name]/
│   │   ├── components/
│   │   ├── services/
│   │   ├── models/
│   │   ├── __tests__/
│   │   └── index.ts
│   └── [another-module]/
├── shared/
│   ├── components/
│   ├── utils/
│   └── types/
└── index.ts
```

### 3.3 TypeScript

- Verwende strikte Typprüfung
- Keine `any` Types
- Dokumentiere komplexe Typen

---

## 4. Review-Prozess

### 4.1 Pull Request Checklist

- [ ] Branch Name folgt Richtlinien
- [ ] Commit Messages sind aussagekräftig
- [ ] Dokumentation aktualisiert
- [ ] Tests geschrieben / aktualisiert
- [ ] Code passt zu Style Guide
- [ ] Keine Merge Konflikte

### 4.2 Review-Anfrage

```
Beschreibe:
1. Was wurde geändert?
2. Warum wurde es geändert?
3. Wie wurde es getestet?
4. Links zu relevanten Dokumenten
```

---

## 5. Testing

### 5.1 Test-Anforderungen

- Unit Tests für alle Funktionen
- Integration Tests für Module
- E2E Tests für kritische Flows

### 5.2 Test-Beispiel

```typescript
describe('UserService', () => {
  it('should create a user', () => {
    const user = new UserService().create({
      name: 'John'
    });
    expect(user.name).toBe('John');
  });
});
```

---

## 6. Häufige Fragen

**F: Wie füge ich ein neues Modul hinzu?**
A: Siehe Punkt 1.2 oder kopiere das MODULE_TEMPLATE

**F: Welcher Status sollte ein neues Dokument haben?**
A: DRAFT bis es überprüft und genehmigt wurde

**F: Kann ich direkt auf main pushen?**
A: NEIN! Immer einen Feature-Branch erstellen

---

## 7. Kontakt & Support

- **Fragen:** Siehe Dokumentation in `/docs`
- **Bugs:** Erstelle ein Issue
- **Ideen:** Diskutiere im Projekt

---

## 8. Lizenz

Durch Beitrag zu diesem Projekt stimmst du zu, dass deine Arbeiten unter der gleichen Lizenz veröffentlicht werden.

