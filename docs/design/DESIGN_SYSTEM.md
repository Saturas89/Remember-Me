# Design System - Simple Workout

**Status:** 🟢 DRAFT  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-04-03

---

## 1. Design-Prinzipien

- [Prinzip 1]: [Beschreibung]
- [Prinzip 2]: [Beschreibung]
- [Prinzip 3]: [Beschreibung]

---

## 2. Farben

### Primärfarben

| Name | Hex | RGB | Verwendung |
|------|-----|-----|-----------|
| Primary | #XXXXXX | rgb(0,0,0) | Hauptelement |
| Secondary | #XXXXXX | rgb(0,0,0) | Sekundärelement |

### Statusfarben

| Status | Farbe | Hex |
|--------|-------|-----|
| Success | 🟢 | #4CAF50 |
| Warning | 🟡 | #FFC107 |
| Error | 🔴 | #F44336 |
| Info | 🔵 | #2196F3 |

---

## 3. Typographie

### Fonts

- **Heading Font:** [Font-Name]
- **Body Font:** [Font-Name]

### Größen und Gewichte

| Verwendung | Größe | Gewicht |
|-----------|-------|---------|
| H1 | 32px | Bold (700) |
| H2 | 24px | Bold (700) |
| H3 | 20px | Semi-Bold (600) |
| Body | 16px | Regular (400) |
| Small | 14px | Regular (400) |
| Caption | 12px | Regular (400) |

---

## 4. Spacing

```
8px Grid System

xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
xxl: 48px
```

---

## 5. Komponenten

### 5.1 Button

**Varianten:**
- Primary
- Secondary
- Tertiary
- Ghost

**Größen:**
- Small
- Medium (default)
- Large

---

### 5.2 Card

- Standardformat
- Mit Bild
- Mit Aktion

---

### 5.3 Input Feld

- Text Input
- Select
- Checkbox
- Radio Button

---

## 6. Icons

- [Icon-Set]: [Beschreibung]
- Größen: 16px, 24px, 32px
- Farben: Follow primary color scheme

---

## 7. Accessibility (a11y)

- [ ] WCAG 2.1 AA Konformität
- [ ] Kontrastverhältnis mindestens 4.5:1
- [ ] Keyboard Navigation unterstützt
- [ ] Screen Reader kompatibel
- [ ] Responsiv auf Mobilgeräten

---

## 8. Dark Mode

- [Color Palette für Dark Mode]
- [Kontrastverhältnisse für Dark Mode]

---

## 9. Responsive Breakpoints

| Gerät | Breakpoint |
|-------|-----------|
| Mobile | < 576px |
| Tablet | 576px - 992px |
| Desktop | ≥ 992px |

---

## 10. Animationen

| Animation | Dauer | Timing Function |
|-----------|-------|-----------------|
| Fade | 200ms | ease-in-out |
| Slide | 300ms | ease-out |
| Scale | 250ms | cubic-bezier(...) |

---

## 11. Code Beispiele

### Button Component

```tsx
<Button variant="primary" size="md" onClick={handleClick}>
  Klick mich
</Button>
```

---

## 12. Ressourcen

- [Figma Design File](https://figma.com/...)
- [Storybook](http://storybook.example.com)
- [Color Palette Tool](https://coolors.co/...)

