# /board – Decision Board

Bevor du irgendetwas anderes tust: **führe das Suitability Gate aus.**

---

## 1 · Suitability Gate (immer zuerst)

Prüfe, ob die Frage in eine dieser Kategorien fällt:

**Board bringt Mehrwert bei:**
- Pricing- und Format-Entscheidungen
- Hiring-Profilen (Rolle definieren, Kandidaten bewerten)
- Build-vs-Buy-Abwägungen
- Karriere-Pivots
- Investment-Cases
- Vorbereitung auf schwierige Stakeholder-Gespräche

**Board bringt keinen Mehrwert bei:**
- Faktenfragen („Was ist X?", „Wie funktioniert Y?")
- Kreatives Schreiben
- Zusammenfassungen
- Technisches Debugging
- Alles, wo eine einzige klare Antwort existiert

**Gate-Entscheidung:**

→ **Nicht geeignet**: Antworte direkt und erkläre in einem Satz warum das Board hier nicht hilft.
Beispiel: *„Das ist eine Faktenfrage – kein Abwägungsproblem. Hier die Antwort direkt: …"*

→ **Geeignet**: Fahre mit Schritt 2 fort.

---

## 2 · Board einberufen

Kündige kurz an welche Frage das Board behandelt, dann spawne diese **4 Agenten parallel** (alle im selben Tool-Call):

| Agent | Subagent-Typ | Fokus |
|---|---|---|
| CFO | `board-cfo` | Financials, Margins, Pricing-Modelle, Unit Economics |
| Growth Lead | `board-growth` | Acquisition, Conversion, Positionierung, Messaging |
| Customer Advocate | `board-customer` | Nutzerbedürfnisse, Retention, Churn-Risiken |
| Devil's Advocate | `board-devil` | Blinde Flecken, Risiken, Gegenargumente |

Übergib jedem Agenten die originale Frage vollständig als Prompt, ergänzt um diese Anweisungen – **wörtlich**:

> „Antworte ausschließlich aus deiner Perspektive als [Rolle]. Du siehst die Antworten der anderen Mitglieder nicht und zitierst sie nicht.
> Umfang: 150–250 Wörter.
> Struktur: (1) deine Analyse, (2) deine Empfehlung, (3) ein konkretes Risiko, das du siehst.
> Bleib strikt in deinem Charakter. Sei direkt. Negative Schlussfolgerungen sind ausdrücklich okay."

---

## 3 · Synthese

Nachdem alle 4 Agenten geantwortet haben, gib zuerst jede Antwort **vollständig und unverändert** aus – mit Überschrift der Rolle, klar voneinander getrennt.

Dann produziere **genau diese fünf Blöcke**:

```
## Board-Entscheidung: [Frage in 6 Wörtern]

### 1 · Wo das Panel einig ist
[Punkte, auf die mehrere Mitglieder unabhängig voneinander kamen.]

### 2 · Wo es knirscht
[Echte Widersprüche zwischen den Voten. Nicht glattbügeln.]

### 3 · Was alle übersehen haben
[Etwas Relevantes, das kein einziges Mitglied angesprochen hat, aber zählt.]

### 4 · Empfehlung [Confidence: hoch / mittel / niedrig]
[Klare, handlungsorientierte Antwort. Kein „kommt drauf an".
Lass das Ergebnis stehen, auch wenn es unangenehm ist.
Revidiere nur bei neuen Belegen, nicht bei Gegendruck.]

### 5 · Erster konkreter Schritt
[Eine einzige Sache, die als nächstes getan werden sollte.]
```
