// German UI strings for the Sandra-first flow (REQ-020).
//
// Kept in a flat, keyed map so they can be looked up directly in components.
// The structure mirrors `src/i18n/en/sandraFlow.ts` 1:1 — every key here MUST
// have an English counterpart.

export const SANDRA_FLOW_DE = {
  // ── Landing (Screen 1) ─────────────────────────────────────────────
  landing: {
    title: 'Was wolltest du {anrede} schon immer fragen?',
    subline: 'Du fragst – {anrede} antwortet, wann es passt. Ein Geschenk, das bleibt.',
    primaryCta: 'Erste Frage formulieren',
    steps: [
      'An wen denken',
      'Fragen formulieren',
      'Per Link an {anrede} verschenken',
    ],
    privacyBadges: [
      'Keine Anmeldung',
      'Keine Cloud',
      'Bleibt auf {anrede}s Gerät',
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
    /** Placeholder for the anrede input, per chip. The four direct chips
     *  pre-fill the value via the auto-fill effect; for everyone else the
     *  field stays empty and we show a concrete example instead. */
    chipPlaceholders: {
      mama: 'Mama',
      papa: 'Papa',
      oma: 'Oma',
      opa: 'Opa',
      tante_onkel: 'z. B. Tante Heidi',
      geschwister: 'z. B. Anna',
      other: 'z. B. Patentante',
    },
    otherPlaceholder: 'z. B. Schwester, Patentante',
    anredeLabel: 'Wie sprichst du sie/ihn an?',
    anredeHelper: 'Übernommen von oben, kannst du anpassen – z. B. „Mama", „Omi", „Vati", Vorname.',
    anredePlaceholder: 'Mama',
    birthYearLabel: 'Geburtsjahr (optional)',
    birthYearPlaceholder: 'z. B. 1957',
    next: 'Weiter',
    validationRelation: 'Bitte wähle aus, an wen du denkst.',
    validationAnrede: 'Bitte trag ein, wie du sie/ihn ansprichst.',
  },

  // ── Trigger pick (Screen 3) ────────────────────────────────────────
  trigger: {
    sectionAboutThem: 'Über {anrede}',
    sectionAboutUs: 'Über uns zwei',
    sectionAboutUsHeart: '❤',
    sectionAboutUsHint: 'Diese Fragen gehen näher – formulier sie in deinem eigenen Tempo.',
    typeMyOwn: 'Eigene Frage formulieren',
  },

  // ── Composer (Screen 4) ────────────────────────────────────────────
  composer: {
    triggerChipLabel: 'Thema',
    backToTriggers: 'Anderes Thema',
    seedLabel: 'Was schießt dir dazu durch den Kopf? Ein Stichwort reicht.',
    seedHelper: 'Aus deinem Stichwort entstehen unten Frage-Vorschläge.',
    seedPlaceholders: [
      'die Hungerjahre',
      'Onkel Karl',
      'als du jung warst',
      'bevor ich geboren wurde',
      'der Streit damals',
    ],
    suggestionsHeading: 'Vorschläge',
    suggestionsHint: 'Wähle einen Vorschlag oder pass ihn an.',
    suggestionUse: 'Übernehmen',
    suggestionEdit: 'Anpassen',
    suggestionDiscardAria: 'Vorschlag entfernen',
    inspirationToggle: 'Wie haben andere gefragt?',
    inspirationHint: 'Klick auf eine Frage, um sie als Stichwort zu übernehmen.',
    freeformLabel: 'Eigene Frage',
    freeformPlaceholder: 'Deine Frage in deinen Worten…',
    freeformHelper: 'Tipp die Frage so, wie du sie {anrede} stellen würdest.',
    discard: 'Abbrechen',
    addQuestion: 'Frage übernehmen',
    addEmptyError: 'Bitte tipp eine Frage ein oder wähl einen Vorschlag.',
  },

  // ── Question list (Screen 5) ───────────────────────────────────────
  list: {
    title: 'Deine Fragen für {anrede}',
    emptyHint: '5 Fragen sind ein schöner Auftakt – aber auch 1 reicht.',
    addAnother: 'Frage hinzufügen',
    send: 'An {anrede} schicken',
    triggerChipAria: 'Thema',
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
    privacyHint: 'Auch {anrede}s Antworten bleiben auf {anrede}s Gerät.',
    relationshipHint:
      'Ein paar Fragen sind sehr persönlich. Vielleicht magst du {anrede} kurz anrufen, bevor du den Link schickst.',
    backToList: 'Zurück zur Liste',
    shareMessage: 'Ich habe ein paar Fragen für dich aufgeschrieben ✨\n\n{url}',
    shareTitle: '{anrede}, ich habe Fragen für dich',
    /** What the recipient sees when they open the link – shown to the sender
     *  before they hit send, so they don't share blind. */
    recipientPreviewHeading: 'Das sieht {anrede}, wenn sie den Link öffnet:',
    recipientPreviewLines: [
      'Eine kurze Begrüßung mit deinem Namen.',
      'Deine Fragen, eine nach der anderen.',
      'Antworten per Tippen oder Spracheingabe – keine App-Installation nötig.',
    ],
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
