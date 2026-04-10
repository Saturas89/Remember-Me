# Anforderung: Data Storage & Backend Integration

**Status:** 🟢 DRAFT  
**ID:** REQ-004  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-03  
**Modul:** Data Layer  
**Priorität:** High  

---

## 1. Zusammenfassung

Die App speichert Benutzerdaten sicher lokal und auf einem Backend-Server. Benutzer können sich anmelden und ihre Daten über mehrere Geräte synchronisieren.

---

## 2. Funktionale Anforderungen

### 2.1 Authentifizierung

- [ ] **FR-1.1:** Benutzer kann sich registrieren
- [ ] **FR-1.2:** Benutzer kann sich anmelden
- [ ] **FR-1.3:** Benutzer kann sich abmelden
- [ ] **FR-1.4:** Benutzer kann Passwort zurücksetzen
- [ ] **FR-1.5:** Session bleibt über Browser-Restart erhalten

### 2.2 Lokale Datenspeicherung

- [ ] **FR-2.1:** Alle Workouts werden lokal gespeichert
- [ ] **FR-2.2:** Alle Einstellungen werden lokal gespeichert
- [ ] **FR-2.3:** Daten bleiben nach App-Neustart erhalten
- [ ] **FR-2.4:** Benutzer kann Daten exportieren (z.B. CSV, JSON)
- [ ] **FR-2.5:** Benutzer kann gelöschte Daten nicht wiederherstellen (permanent)

### 2.3 Cloud-Synchronisation

- [ ] **FR-3.1:** Daten werden auf Backend synchronisiert
- [ ] **FR-3.2:** Mehrere Geräte können synchronisiert werden
- [ ] **FR-3.3:** Daten sind zwischen Geräten konsistent
- [ ] **FR-3.4:** Alte Versionen werden nicht vorgespeichert

### 2.4 Benutzer-Datenverwaltung

- [ ] **FR-4.1:** Benutzer kann sein Profil bearbeiten
- [ ] **FR-4.2:** Benutzer kann alle seine Daten sehen
- [ ] **FR-4.3:** Benutzer kann sein Konto löschen (GDPR)
- [ ] **FR-4.4:** Benutzer kann seine Daten herunterladen (GDPR)

---

## 3. Nicht-funktionale Anforderungen

### 3.1 Datensicherheit

| Anforderung | Details |
|-------------|---------|
| **Übertragung** | HTTPS, kein unverschlüsselter HTTP |
| **Authentifizierung** | Token-basiert (JWT, OAuth, etc.) |
| **Autorisierung** | Benutzer sieht nur seine eigenen Daten |
| **Passwort** | Secure Hashing (bcrypt, Argon2, etc.) |
| **Datenbank** | Encrypted at Rest (optional) |

### 3.2 Datenschutz (GDPR/Privacy)

- [ ] **NFR-2.1:** Benutzer kann alle seine Daten exportieren
- [ ] **NFR-2.2:** Benutzer kann sein Konto löschen
- [ ] **NFR-2.3:** Daten werden nicht 3. Parteien weitergegeben
- [ ] **NFR-2.4:** Privacy Policy und ToS vorhanden
- [ ] **NFR-2.5:** Cookies-Consent vor Tracking

### 3.3 Speicherung & Quota

| Anforderung | Wert |
|-------------|------|
| **Pro Benutzer** | Mindestens 100MB |
| **Maximale Workouts** | 10.000+ |
| **Maximale Übungen pro Workout** | 500+ |
| **Daten-Aufbewahrung** | Bis Konto gelöscht |

### 3.4 Verfügbarkeit & Zuverlässigkeit

| Anforderung | Wert |
|-------------|------|
| **Server Uptime** | 99.9% |
| **Backup-Häufigkeit** | Täglich |
| **Disaster Recovery** | Plan für Datenwiederherstellung |
| **Daten-Redundanz** | Mindestens 2 Kopien |

### 3.5 Performance

| Anforderung | Wert |
|-------------|------|
| **API Response Time** | < 500ms (p95) |
| **Daten-Upload** | < 2 Sekunden für typische Workouts |
| **Daten-Download** | < 1 Sekunde auf 4G |
| **Datenbank Queries** | < 100ms (p95) |

---

## 4. Framework Anforderungen

### 4.1 Backend API

- [ ] **FW-1.1:** RESTful API oder GraphQL
- [ ] **FW-1.2:** Versioning für API Kompatibilität
- [ ] **FW-1.3:** Rate Limiting gegen Missbrauch
- [ ] **FW-1.4:** Error Codes und Fehler-Messages

### 4.2 Datenbank

- [ ] **FW-2.1:** Relational (PostgreSQL, MySQL) oder NoSQL (MongoDB, Firebase)
- [ ] **FW-2.2:** Transactions für Datenkonsistenz
- [ ] **FW-2.3:** Indizes für Performance
- [ ] **FW-2.4:** Regelmäßige Backups

### 4.3 Authentifizierung

- [ ] **FW-3.1:** JWT oder OAuth 2.0
- [ ] **FW-3.2:** Token Expiration & Refresh
- [ ] **FW-3.3:** Secure Session Management
- [ ] **FW-3.4:** Optional: Multi-Factor Authentication (MFA)

### 4.4 Frontend Storage

- [ ] **FW-4.1:** IndexedDB für Offline-Daten
- [ ] **FW-4.2:** LocalStorage für Preferences
- [ ] **FW-4.3:** In-Memory Cache für Performance

---

## 5. Abhängigkeiten

- **REQ-001:** PWA Foundation
- **REQ-003:** Offline Funktionalität
- **Backend Server:** Muss bereitgestellt werden
- **Datenbank:** Muss bereitgestellt werden

---

## 6. Akzeptanzkriterien

- [ ] **AC-1:** Benutzer kann sich registrieren und anmelden
- [ ] **AC-2:** Daten werden lokal und auf Server gespeichert
- [ ] **AC-3:** Daten sind zwischen Geräten synchronisiert
- [ ] **AC-4:** Benutzer kann nur seine eigenen Daten sehen
- [ ] **AC-5:** Benutzer kann Konto löschen (GDPR)
- [ ] **AC-6:** API antwortet in < 500ms

---

## 7. Nicht-umfasst (Out of Scope)

- [ ] Social Features (Freunde, Sharing)
- [ ] Analytics und Tracking
- [ ] Machine Learning / Recommendations
- [ ] Premium Features oder Monetization

---

## 8. Szenarien

### Szenario 1: Neuer Benutzer
```
1. Benutzer registriert sich mit E-Mail
2. Bestätigungs-E-Mail wird gesendet
3. Benutzer verifiziert E-Mail
4. Kann sich jetzt anmelden
```

### Szenario 2: Multi-Device Sync
```
1. Benutzer erstellt Workout auf Handy
2. Handy synced zu Backend
3. Benutzer öffnet App auf Desktop
4. Desktop synced vom Backend
5. Dasselbe Workout ist auf Desktop sichtbar
```

---

## 9. Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|---------|
| 1.0.0 | 2026-04-03 | Claude | Initiale Version (bereinigt) |

