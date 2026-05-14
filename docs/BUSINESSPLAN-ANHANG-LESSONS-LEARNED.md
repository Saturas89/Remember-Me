# Anhang zum Business-Plan: Was ich gelernt habe

> Begleit-Dokument zum Storyhold-Business-Plan (v2.4).
> Stand: 2026-05-14.

Diese Liste fasst kompakt zusammen, mit welchen Themen ich mich im Laufe
des Projekts vertieft beschäftigt habe — als Lerngeschichte hinter dem
Business-Plan, nicht als Roadmap.

## Themen, mit denen ich mich beschäftigt habe

1. **Marktrecherche** – Wettbewerber (StoryWorth, Remento, Lifebook, Meminto, Storii), Preispunkte, Zielgruppen-Ansprache.
2. **Zielgruppen-Definition & Personas** – Senior-Erzählerin „Ingrid" (67, Erst-Kontakt + Routine-Nutzung) und Tochter-Käuferin „Sandra" (42, Geschenk-Käuferin + Family-Manager).
3. **Geschenk-Logik (Sandra-First-Flow)** – Zwei-Personen-Onboarding, in dem die Käuferin die App für Mama einrichtet; Conversion-Trigger Muttertag / Geburtstag.
4. **Preismodell & Geschäftsmodell** – Freemium vs. Einmalkauf vs. Abo, Premium-Features (Biografie-Generator, gedrucktes Buch).
5. **Lizenz- und Open-Source-Strategie** – AGPL-3.0-or-later für den offenen Kern, proprietäre Premium-Komponenten im privaten `remember-me-pro`-Repo (ADR-001).
6. **Rechtliches** – Impressum nach DDG § 5 und MStV § 18, Datenschutz-Wording, AGB-Skizze, Hinweise zu DSGVO bei Cloud-Sync.
7. **Datenschutz & Vertrauen** – Lokale Speicherung als Default, Ende-zu-Ende-Verschlüsselung (AES-256-GCM, ECDH P-256, HKDF), Zero-Knowledge-Server, Recovery-Code-abgeleiteter Schlüssel.
8. **Security-Hardening** – H1–H7-Audit (Drive-Media verschlüsseln, AAD-Bindung, RLS-Tightening, Sign-Up/Sign-In trennen, Vault-Key non-extractable, PBKDF2 600k Iterationen, monotone Envelope-Version).
9. **Sync-Architektur** – Drei Provider parallel: Google Drive, Microsoft OneDrive (deaktiviert), Storyhold-Server (Supabase mit RLS); Friendly Errors, OneDrive-UI, Memories-Counter.
10. **Familien- und Co-Author-Modus** – Familien-Räume (REQ-015), Geschwister-Einladungen, Freunde-Antwort-Import, Handshake-Retries, Last-Active-Indikator.
11. **Senior-freundliche UX** – „Vereinfachter Bedienmodus" (REQ-019): reduzierte UI, große Schrift, 44 px Tap-Targets, Power-Features ausgeblendet, konsistentes „du" im Onboarding.
12. **Audio-Aufnahme & Transkription** – Mic-Permission-Flow, lokale Web-Speech-API, retryable Mic-Wait, Original-Audio optional speichern.
13. **Medien-Anhänge** – Foto-Komprimierung (1200 px, 82 % JPEG), Video-Anhänge, IndexedDB-Stores (`rm-images`, `rm-audio`, `rm-videos`).
14. **Erinnerungs-Archiv** – ZIP-Export + -Import inklusive aller Medien, Book-Readiness-Indikator.
15. **Frage-Engine & Inhalt** – 6 Kategorien × 10 Fragen, freie eigene Fragen, themenspezifische Freunde-Einladungen (4 Themen × 5 Fragen).
16. **Mehrsprachigkeit** – Vollständige DE/EN-Lokalisierung inkl. Onboarding, FAQ, Release Notes, Kategorien, Fragen.
17. **Design-System** – Friends-Tab als kanonische Referenz: CSS-Variablen, feste Spacing-Skala (0,2/0,4/0,6/0,75/1/2/3 rem), Radius-Konvention, vier Themes (Sepia, Nacht, Hell, Ozean).
18. **Onboarding & Re-Entry** – Welcome-Back-Banner, Stack-Suppress-Reminder, ehrliches Inspiration-Drawer-Wording, Days-Away-Wording retiret.
19. **Release-Kommunikation** – „Was ist neu?"-Modal (REQ-014), gepflegte `releaseNotes.ts`, Keep-a-Changelog in `docs/CHANGELOG.md`.
20. **CI/CD-Pipeline** – Vitest-Unit + Playwright-E2E über 5 Browser-Projekte, Firefox-Sharding, doc-only-Skip, aktives Polling statt Comment-Heartbeat.
21. **Qualitäts-Gates** – Doc-Sync-Check, Changelog-Check, License-Audit, Coverage-Thresholds, Integration-Test-Layer.
22. **Requirements-Disziplin** – 19 REQ-Specs mit MoSCoW-Priorisierung, ADRs für architektonische Weichenstellungen, dokumentiertes Postmortem (PR #74 / REQ-016).
23. **Tech-Stack-Entscheidungen** – React 19, Vite 7, TypeScript, vite-plugin-pwa, Vercel-Deployment, Supabase als optionales Backend.
24. **Branding & Naming** – Rebrand von „Remember Me" auf „Storyhold", Logo-Animation, App-Icons, Splash-Screen, Manifest.

## Was diese Liste nicht ist

Kein Status-Report (siehe `docs/README.md`), keine Roadmap (siehe
„Roadmap" im selben Dokument), kein Changelog (siehe
`docs/CHANGELOG.md`). Diese Liste beschreibt Lern-Bereiche, in die
unverhältnismäßig viel Denkarbeit geflossen ist und die im
Business-Plan in verdichteter Form auftauchen.
