# Architektur – Remember Me

Technische Modulübersicht der App.

---

## Module

| Modul | Beschreibung | Dateien |
|-------|-------------|---------|
| **Core** | PWA Foundation, Service Worker, App Shell, Routing | `App.tsx`, `useServiceWorker.ts`, `useInstallPrompt.ts` |
| **Questions** | Frage-Engine, Fragenkatalog, Kategorien, Frage-Flow | `QuizView.tsx`, `QuestionCard.tsx`, `data/questions.ts` |
| **Data** | localStorage (Zustand), IndexedDB (Bilder, Audio, Video) | `useAnswers.ts`, `useImageStore.ts`, `useAudioStore.ts`, `useVideoStore.ts` |
| **Export** | Markdown, JSON, Backup, ZIP-Archiv, Share Sheet | `utils/export.ts`, `utils/archiveExport.ts`, `utils/archiveImport.ts` |
| **UI** | Design System, 4 Themes, Responsive Layout, Bottom-Nav | `App.css`, `BottomNav.tsx`, `useTheme.ts` |
| **Friends** | Einladungslinks, Antwort-Import, Share-Link-Flow | `FriendsView.tsx`, `FriendAnswerView.tsx`, `utils/sharing.ts` |
| **Media** | Foto-Anhänge, Audio-Aufnahme, Video-Anhänge | `ImageAttachment.tsx`, `AudioRecorder.tsx`, `VideoAttachment.tsx` |

---

## Abhängigkeiten

```
Core (PWA Foundation)
  ├── Data (localStorage + IndexedDB)
  ├── UI (Themes, Komponenten)
  ├── Questions (Frage-Engine)
  ├── Media (Bilder, Audio, Video)
  ├── Friends (Einladungen, Import)
  └── Export (Markdown, JSON, ZIP, Backup)
```
