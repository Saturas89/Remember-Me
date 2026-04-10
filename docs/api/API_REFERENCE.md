# API Referenz - Simple Workout

**Status:** 🟢 DRAFT  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-03

---

## 1. API Übersicht

Beschreibung der API und deren Zweck.

### Base URL

```
https://api.example.com/v1
```

### Authentifizierung

```
Authorization: Bearer {token}
```

---

## 2. Endpoints

### 2.1 Ressource: [Ressource]

#### GET /[ressource]

Beschreibung: [Kurzbeschreibung]

**Request:**
```http
GET /[ressource] HTTP/1.1
Authorization: Bearer token
```

**Parameters:**
| Parameter | Type | Required | Beschreibung |
|-----------|------|----------|------------|
| id | string | Yes | ID der Ressource |
| filter | string | No | Filter Parameter |

**Response (200 OK):**
```json
{
  "id": "123",
  "name": "Name",
  "created_at": "2026-04-03T10:00:00Z"
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "INVALID_REQUEST",
  "message": "Invalid parameter"
}
```

---

#### POST /[ressource]

Beschreibung: Neue Ressource erstellen

**Request:**
```http
POST /[ressource] HTTP/1.1
Content-Type: application/json
Authorization: Bearer token

{
  "name": "Name"
}
```

**Request Body:**
| Field | Type | Required | Beschreibung |
|-------|------|----------|------------|
| name | string | Yes | Name der Ressource |

**Response (201 Created):**
```json
{
  "id": "123",
  "name": "Name",
  "created_at": "2026-04-03T10:00:00Z"
}
```

---

#### PUT /[ressource]/{id}

Beschreibung: Ressource aktualisieren

**Response (200 OK):**
```json
{
  "id": "123",
  "name": "Updated Name",
  "updated_at": "2026-04-03T11:00:00Z"
}
```

---

#### DELETE /[ressource]/{id}

Beschreibung: Ressource löschen

**Response (204 No Content):**
```
[Kein Response Body]
```

---

## 3. Fehler-Codes

| Code | Status | Beschreibung |
|------|--------|------------|
| 400 | Bad Request | Ungültige Request Parameter |
| 401 | Unauthorized | Authentifizierung erforderlich |
| 403 | Forbidden | Zugriff verweigert |
| 404 | Not Found | Ressource nicht gefunden |
| 409 | Conflict | Konflikt (z.B. Duplikat) |
| 500 | Internal Server Error | Server Fehler |

---

## 4. Authentifizierung

### Token abrufen

```http
POST /auth/login HTTP/1.1
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600
}
```

---

## 5. Rate Limiting

- **Limit:** 1000 Requests pro Stunde
- **Header:** `X-RateLimit-Remaining`
- **Status Code:** 429 (Too Many Requests)

---

## 6. Pagination

```
GET /ressource?page=1&limit=10

Response:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

---

## 7. Filtering

```
GET /ressource?filter[field]=value&filter[created_at][gte]=2026-01-01
```

---

## 8. Datentypen

| Typ | Format | Beispiel |
|-----|--------|---------|
| String | UTF-8 Text | "Hello" |
| Number | Integer/Float | 42, 3.14 |
| Boolean | true/false | true |
| DateTime | ISO 8601 | "2026-04-03T10:00:00Z" |
| UUID | UUID v4 | "123e4567-e89b-12d3-a456-426614174000" |

---

## 9. SDKs & Clients

- [JavaScript/TypeScript](https://github.com/...)
- [Python](https://github.com/...)
- [Go](https://github.com/...)

---

## 10. Webhook Events

```json
{
  "event": "resource.created",
  "data": {...},
  "timestamp": "2026-04-03T10:00:00Z"
}
```

---

## 11. Best Practices

- Verwende HTTP Status Codes korrekt
- Implementiere Retry-Logik mit Backoff
- Cache Responses mit Bedacht
- Validiere alle Eingaben
- Dokumentiere Breaking Changes

---

## 12. Changelog

| Version | Datum | Änderung |
|---------|-------|---------|
| 1.0.0 | 2026-04-03 | Initiale Version |

