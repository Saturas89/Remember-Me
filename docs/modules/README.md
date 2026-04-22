# Architektur

Technische Modulübersicht des Projekts. Diese Datei wird pro Repo mit den tatsächlichen Modulen befüllt — unten steht eine Struktur-Vorlage, die für die meisten Frontend-/Fullstack-Projekte passt.

---

## Module (Vorlage)

| Modul | Beschreibung | Typische Dateien |
|-------|-------------|------------------|
| **Core** | App-Gerüst, Routing, Bootstrapping | `App.tsx`, `main.tsx`, Router-Setup |
| **UI** | Design-System, Layouts, Theme, gemeinsame Komponenten | `components/`, Theme-Hooks, globale Styles |
| **Data** | Persistenz, State, Caching | Storage-Hooks, Repository-Schicht |
| **Domain** | Fachlogik (reine Funktionen, Typen) | `utils/`, `types.ts` |
| **Features** | Eigenständige Feature-Slices | `views/`, `features/<name>/` |
| **Integrations** | Externe Services (API-Clients, SDKs) | `integrations/`, `lib/` |
| **Testing** | Test-Helper, Fixtures, Page-Objects | `src/**/*.test.*`, `e2e/` |

Spalten nach Bedarf ergänzen oder entfernen. Ziel ist, dass neue Mitwirkende in < 2 Minuten sehen, wo neuer Code hingehört.

---

## Abhängigkeitsrichtung

```
Core
  ├── UI
  ├── Data
  ├── Domain
  ├── Features  →  UI, Data, Domain
  └── Integrations  →  Domain
```

Regel: Es gibt **keinen** Abhängigkeits-Pfeil, der nach oben zeigt. Feature-Slices dürfen die Basis-Module nutzen, umgekehrt nicht.
