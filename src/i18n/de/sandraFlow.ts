// German UI strings for the Sandra-first flow (REQ-020).
//
// Kept in a flat, keyed map so they can be looked up directly in components.
// The structure mirrors `src/i18n/en/sandraFlow.ts` 1:1 — every key here MUST
// have an English counterpart.

export const SANDRA_FLOW_DE = {
  // ── Landing (Screen 1) ─────────────────────────────────────────────
  landing: {
    title: 'Was wolltest du deine Mutter schon immer fragen?',
    subline: 'In 2 Minuten formulierst du deine eigenen Fragen.',
    primaryCta: 'Erste Frage formulieren',
    howItWorks: 'Wie es funktioniert',
    steps: [
      'Anker setzen',
      'Fragen formulieren',
      'An Mama schicken',
    ],
  },

  // ── Anchor step (Screen 2) ─────────────────────────────────────────
  anchor: {
    title: 'An wen denkst du gerade?',
    chipLabels: {
      mama: 'Mama',
      papa: 'Papa',
      oma: 'Oma',
      opa: 'Opa',
      tante_onkel: 'Tante/Onkel',
      geschwister: 'Geschwister',
      other: 'Andere',
    },
    otherPlaceholder: 'z. B. Schwester, Patentante',
    anredeLabel: 'Wie sprichst du sie/ihn an?',
    anredeHelper: 'Default vom Chip, aber bearbeitbar – z. B. „Mama", „Omi", „Vati", Vorname.',
    anredePlaceholder: 'Mama',
    birthYearLabel: 'Geburtsjahr (optional)',
    birthYearPlaceholder: 'z. B. 1957',
    next: 'Weiter',
    validationRelation: 'Bitte wähle aus, an wen du denkst.',
    validationAnrede: 'Bitte trag ein, wie du sie/ihn ansprichst.',
  },

  // ── Trigger pick (Screen 3) ────────────────────────────────────────
  trigger: {
    sectionAboutThem: 'Über sie/ihn',
    sectionAboutUs: 'Über uns zwei',
    sectionAboutUsHeart: '❤',
    sectionAboutUsHint: 'Diese Fragen gehen näher – formulier sie in deinem eigenen Tempo.',
    typeMyOwn: 'Ich tippe lieber selbst eine Frage',
  },

  // ── Composer (Screen 4) ────────────────────────────────────────────
  composer: {
    triggerChipLabel: 'Trigger',
    backToTriggers: 'Anderer Trigger',
    seedLabel: 'Was schießt dir dazu durch den Kopf? Ein Stichwort reicht.',
    seedPlaceholders: [
      'die Hungerjahre',
      'Onkel Karl',
      'als du jung warst',
      'bevor ich geboren wurde',
      'der Streit damals',
    ],
    suggestionsHeading: 'Vorschläge',
    suggestionsHint: 'Wähle einen Vorschlag oder pass ihn an.',
    suggestionUse: 'So nehmen',
    suggestionEdit: 'Anpassen',
    suggestionDiscardAria: 'Vorschlag entfernen',
    inspirationToggle: 'Wie haben andere gefragt?',
    inspirationHint: 'Klick auf eine Frage, um sie als Stichwort in deinen Composer zu übernehmen.',
    freeformLabel: 'Eigene Frage',
    freeformPlaceholder: 'Deine Frage in deinen Worten…',
    discard: 'Verwerfen',
    addQuestion: 'Frage übernehmen',
    addEmptyError: 'Bitte tipp eine Frage ein oder wähl einen Vorschlag.',
  },

  // ── Question list (Screen 5) ───────────────────────────────────────
  list: {
    title: 'Deine Fragen für {anrede}',
    emptyHint: '5 Fragen sind ein schöner Auftakt – aber auch 1 reicht.',
    addAnother: 'Frage hinzufügen',
    send: 'An {anrede} schicken',
    triggerChipAria: 'Trigger',
    editAria: 'Bearbeiten',
    moveUpAria: 'Nach oben',
    moveDownAria: 'Nach unten',
    deleteAria: 'Löschen',
    confirmDelete: 'Diese Frage entfernen?',
  },

  // ── Share / send (Screen 6) ────────────────────────────────────────
  share: {
    title: 'Schick {anrede} deine {count} Fragen',
    primaryCta: 'An {anrede} senden',
    sending: 'Wird geöffnet…',
    copied: '✓ Link kopiert!',
    error: '⚠ Nochmal versuchen',
    privacyHint: 'Auch {anrede}s Antworten bleiben auf ihrem Gerät.',
    relationshipHint:
      'Ein paar Fragen sind sehr persönlich. Vielleicht magst du {anrede} kurz anrufen, bevor du den Link schickst.',
    backToList: 'Zurück zur Liste',
    shareMessage: 'Ich habe ein paar Fragen für dich aufgeschrieben ✨\n\n{url}',
    shareTitle: '{anrede}, ich habe Fragen für dich',
  },

  // ── Receiver side (Screen 7, modifications to Friends-Receive) ─────
  receiver: {
    autoSuggestTitle: 'Möchtest du es einfach machen?',
    autoSuggestDesc:
      'Wir können die App auf große Schrift und nur die wichtigsten Knöpfe schalten – ideal, wenn du wenig tippen möchtest.',
    autoSuggestYes: 'Ja, einfach machen',
    autoSuggestNo: 'Wie gewohnt',
    headerTitle: '{senderName} hat dir {n} Fragen geschickt',
    headerSubline: 'In ihren Worten – du kannst einsprechen oder tippen.',
    questionLabel: 'Frage {n} von {total}',
    micAria: 'Sprachaufnahme starten',
    skip: 'Später beantworten',
    next: 'Weiter',
    done: 'Fertig',
    answerPlaceholder: 'Deine Antwort…',
    progressDotAria: 'Frage {n} von {total}',
    welcomeNameLabel: 'Wie heißt du?',
    welcomeNamePlaceholder: 'Dein Name',
    welcomeStart: 'Anfangen',
  },

  // ── Friends-tab entry ──────────────────────────────────────────────
  entryCard: {
    title: 'Eigene Fragen für jemanden formulieren',
    desc: 'Stell deine eigenen Fragen – in deinen Worten, an Mama, Papa, Oma. Sie antwortet, wenn sie mag.',
    cta: 'Loslegen',
  },

  // ── Global ─────────────────────────────────────────────────────────
  back: '← Zurück',
}

export type SandraFlowStrings = typeof SANDRA_FLOW_DE
