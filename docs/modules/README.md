# Module - Remember Me

Übersicht aller technischen Module der App.

---

## 📦 Verfügbare Module

| Modulname | Beschreibung | Status | Dateien |
|-----------|-------------|--------|---------|
| **Core** | PWA Foundation, Service Worker, App Shell, Layout | 🔵 IN PROGRESS | [README](./core/README.md) • [Spec](./core/SPECIFICATION.md) • [Req](./core/REQUIREMENTS.md) • [Arch](./core/ARCHITECTURE.md) |
| **Questions** | Frage-Engine, Fragenkatalog, Kategorien, Frage-Flow | 🟢 DRAFT | [README](./questions/README.md) |
| **Stories** | Lebensarchiv, Antworten anzeigen & verwalten | 🟢 DRAFT | [README](./stories/README.md) |
| **Data** | Lokale Speicherung (localStorage/IndexedDB), Synchronisation | 🟢 DRAFT | [README](./data/README.md) • [Spec](./data/SPECIFICATION.md) |
| **Export** | PDF-Export, Druckansicht, Teilen-Links | 🟢 DRAFT | – |
| **UI** | Design System, Komponenten, Responsive Design | 🟢 DRAFT | [README](./ui/README.md) • [Spec](./ui/SPECIFICATION.md) |

---

## 🔄 Modul-Abhängigkeiten

```
┌─────────────────────────────────────┐
│   Core (PWA Foundation)             │
│   - Service Worker                  │
│   - App Shell / Layout              │
│   - Routing                         │
└──────┬──────────┬──────────┬────────┘
       │          │          │
       ▼          ▼          ▼
  ┌────────┐ ┌────────┐ ┌────────┐
  │  Data  │ │   UI   │ │ Quest. │
  │        │ │        │ │        │
  └────┬───┘ └───┬────┘ └───┬────┘
       │         │          │
       └────┬────┘          │
            ▼               ▼
       ┌─────────┐    ┌──────────┐
       │ Stories │◄───│ (Answers)│
       └────┬────┘    └──────────┘
            │
            ▼
       ┌─────────┐
       │ Export  │
       └─────────┘
```

**Abhängigkeits-Details:**
- **Core:** Basis für alle (keine Abhängigkeiten)
- **Data:** hängt von Core ab – speichert alle Antworten und Profile
- **UI:** hängt von Core ab – stellt alle visuellen Komponenten bereit
- **Questions:** hängt von Core + Data ab – lädt Fragen, speichert Antworten
- **Stories:** hängt von Data + UI ab – zeigt Lebensarchiv an
- **Export:** hängt von Stories + Data ab – exportiert das Archiv

---

## 📈 Modul-Roadmap

| Phase | Module | Status |
|-------|--------|--------|
| Phase 1 – Foundation | Core, Data (localStorage), UI Basics | 🔵 In Arbeit |
| Phase 2 – Core Feature | Questions Engine, Fragenkatalog | 🟢 Geplant |
| Phase 3 – Archiv | Stories View, Bearbeitungsfunktion | 🟢 Geplant |
| Phase 4 – Export | PDF-Export, Teilen | 🟢 Geplant |
| Phase 5 – Erweiterung | Medienanhänge, Familienfreigabe | 🟡 Zukunft |

---

## 🔗 Verwandte Dokumentation

- [Hauptdokumentation](../README.md)
- [Anforderungen](../requirements/README.md)
- [Design System](../design/DESIGN_SYSTEM.md)
