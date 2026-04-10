# Module - Simple Workout

Übersicht aller Module im Projekt mit Links zu deren Dokumentation.

---

## 📋 Modulverzeichnis

### Module Hinzufügen

Um ein neues Modul hinzuzufügen:

1. Kopiere den Ordner `MODULE_TEMPLATE/`
2. Benenne ihn zu `[modul-name]/`
3. Fülle folgende Dateien aus:
   - `README.md` - Modulübersicht
   - `SPECIFICATION.md` - Technische Spezifikation
   - `REQUIREMENTS.md` - Funktionale Anforderungen
   - `ARCHITECTURE.md` - System-Design
   - `CHANGELOG.md` - Versionshistorie

4. Füge die Zeile unten in diese README ein:

```markdown
| [Modul Name] | [Kurzbeschreibung] | [Status] |
```

---

## 📦 Verfügbare Module

| Modulname | Beschreibung | Status | Dateien |
|-----------|------------|--------|---------|
| **Core** | PWA Foundation, Service Worker, Layout | 🟢 DRAFT | [README](./core/README.md) • [Spec](./core/SPECIFICATION.md) • [Req](./core/REQUIREMENTS.md) • [Arch](./core/ARCHITECTURE.md) |
| **Workout** | Trainingsplan Management & Übungen | 🟢 DRAFT | [README](./workout/README.md) • [Spec](./workout/SPECIFICATION.md) • [Req](./workout/REQUIREMENTS.md) • [Arch](./workout/ARCHITECTURE.md) |
| **Data Layer** | Storage, Synchronisation, Backends | 🟢 DRAFT | [README](./data/README.md) • [Spec](./data/SPECIFICATION.md) • [Req](./data/REQUIREMENTS.md) • [Arch](./data/ARCHITECTURE.md) |
| **UI** | Components, Design System, Responsive Design | 🟢 DRAFT | [README](./ui/README.md) • [Spec](./ui/SPECIFICATION.md) • [Req](./ui/REQUIREMENTS.md) • [Arch](./ui/ARCHITECTURE.md) |
| **Offline** | Service Worker, Caching, Offline-First | 🟢 DRAFT | [README](./offline/README.md) • [Spec](./offline/SPECIFICATION.md) • [Req](./offline/REQUIREMENTS.md) • [Arch](./offline/ARCHITECTURE.md) |
| **MODULE_TEMPLATE** | Vorlage für neue Module | 🟢 DRAFT | [README](./MODULE_TEMPLATE/README.md) • [Spec](./MODULE_TEMPLATE/SPECIFICATION.md) • [Req](./MODULE_TEMPLATE/REQUIREMENTS.md) • [Arch](./MODULE_TEMPLATE/ARCHITECTURE.md) |

---

## 🎯 Schnellnavigation

### Neue Module initialisieren

```bash
# 1. Kopiere das Template
cp -r MODULE_TEMPLATE/ [new-module]/

# 2. Bearbeite die Dateien
# 3. Commit mit git
git add docs/modules/[new-module]/
git commit -m "docs: Add [module-name] module documentation"
```

---

## 📊 Modul-Status-Übersicht

```
Legend:
🟢 DRAFT      = In Entwicklung
🟡 REVIEW     = Zur Überprüfung
✅ APPROVED   = Genehmigt und aktiv
🔴 DEPRECATED = Nicht mehr in Verwendung
```

---

## 🔄 Modul-Abhängigkeiten

```
┌─────────────────────────────────────┐
│   Core (PWA Foundation)             │
│   - Service Worker                  │
│   - App Shell                       │
│   - Responsive Layout               │
└──────────────┬──────────────────────┘
               │
       ┌───────┼────────┬─────────┐
       ▼       ▼        ▼         ▼
   ┌────┐  ┌──────┐  ┌────┐  ┌────────┐
   │Data│  │ UI   │  │Offl│ │Workout │
   │    │  │      │  │ine │ │        │
   └────┘  └──────┘  └────┘  └────────┘
       │       │        │         │
       └───────┼────────┴─────────┘
               ▼
        Workout Management
```

**Abhängigkeits-Details:**
- **Core:** Basis für alle anderen Module (keine Abhängigkeiten)
- **Data:** Hängt von Core ab (für Storage & Caching)
- **UI:** Hängt von Core ab (für Responsive Design)
- **Offline:** Hängt von Core ab (für Service Worker)
- **Workout:** Hängt von Core, Data, UI und Offline ab

---

## 📈 Modul-Roadmap

| Phase | Module | Zeitrahmen | Status |
|-------|--------|-----------|--------|
| Phase 1: Foundation | Core, Offline | Q2 2026 | 🟢 Spezifikation in Arbeit |
| Phase 2: Data & UI | Data, UI | Q2 2026 | 🟢 Spezifikation in Arbeit |
| Phase 3: Features | Workout Management | Q2-Q3 2026 | 🟢 Anforderungen definiert |
| Phase 4: Optimierung | Performance, Analytics | Q3 2026 | 🟡 Geplant |

---

## 📚 Dokumentationsstruktur jedes Moduls

```
[module-name]/
├── README.md                # Modulübersicht
├── SPECIFICATION.md         # Technische Details
├── REQUIREMENTS.md          # Funktionale Anforderungen
├── ARCHITECTURE.md          # Architektur-Design
└── CHANGELOG.md             # Versionshistorie
```

---

## 🔗 Verwandte Dokumentation

- [Hauptdokumentation](../README.md)
- [Anforderungen](../requirements/)
- [Design System](../design/DESIGN_SYSTEM.md)
- [Contributing Guide](../guides/CONTRIBUTING.md)

