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

Übergib jedem Agenten die originale Frage vollständig als Prompt, ergänzt um:
> „Antworte aus deiner Perspektive als [Rolle]. 3–5 Sätze Analyse + ein klares Votum (Pro / Contra / Bedingtes Pro mit Bedingung)."

---

## 3 · Synthese

Nachdem alle 4 Agenten geantwortet haben, strukturiere das Ergebnis so:

```
## Board-Entscheidung: [Frage in 6 Wörtern]

### Voten
**CFO** · [Votum-Emoji] – [2 Sätze Kernaussage]
**Growth Lead** · [Votum-Emoji] – [2 Sätze Kernaussage]
**Customer Advocate** · [Votum-Emoji] – [2 Sätze Kernaussage]
**Devil's Advocate** · [Votum-Emoji] – [2 Sätze Kernaussage]

### Konsens & Konflikt
[Wo sind sich 3–4 einig? Wo streiten CFO und Growth? Was sagt nur der Devil's Advocate?]

### Empfehlung
[Klare Handlungsempfehlung in 2–3 Sätzen. Keine Weichspüler wie „es kommt drauf an".]

### Nächster Schritt
[Eine konkrete Aktion, die heute oder diese Woche möglich ist.]
```

Votum-Emojis: ✅ Pro · ❌ Contra · ⚠️ Bedingtes Pro
