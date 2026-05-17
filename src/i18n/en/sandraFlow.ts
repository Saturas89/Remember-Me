// English UI strings for the Sandra-first flow (REQ-020). Mirrors
// `src/i18n/de/sandraFlow.ts` 1:1.

import type { SandraFlowStrings } from '../de/sandraFlow'

export const SANDRA_FLOW_EN: SandraFlowStrings = {
  // ── Landing (Screen 1) ─────────────────────────────────────────────
  landing: {
    title: 'What have you always wanted to ask {anrede}?',
    subline: "You ask – {anrede} answers in their own time. A gift that lasts.",
    primaryCta: 'Compose your first question',
    steps: [
      'Pick the person',
      'Compose questions',
      'Share the link with {anrede} as a gift',
    ],
    privacyBadges: [
      'No account',
      'No cloud',
      "Stays on {anrede}'s device",
    ],
    crossHintToOwnTitle: 'Capture your own memories?',
    crossHintToOwnBody: 'If you\'d rather write your own stories instead of sending questions to someone else, head to the "My Memories" card on the Journey tab.',
  },

  // ── Anchor step (Screen 2) ─────────────────────────────────────────
  anchor: {
    title: 'Who are you thinking of?',
    chipLabels: {
      mama: 'Mom',
      papa: 'Dad',
      oma: 'Grandma',
      opa: 'Grandpa',
      tante_onkel: 'Aunt/Uncle',
      geschwister: 'Sibling',
      other: 'Other',
    },
    chipPlaceholders: {
      mama: 'Mom',
      papa: 'Dad',
      oma: 'Grandma',
      opa: 'Grandpa',
      tante_onkel: 'e.g. Aunt Helen',
      geschwister: 'e.g. Anna',
      other: 'e.g. godmother',
    },
    otherPlaceholder: 'e.g. sister, godmother',
    anredeLabel: 'How do you address them?',
    anredeHelper: "Taken from above, feel free to tweak – e.g. 'Mom', 'Mum', 'Pops', first name.",
    anredePlaceholder: 'Mom',
    birthYearLabel: 'Birth year (optional)',
    birthYearPlaceholder: 'e.g. 1957',
    next: 'Continue',
    validationRelation: 'Please pick who you have in mind.',
    validationAnrede: 'Please type how you address them.',
  },

  // ── Trigger pick (Screen 3) ────────────────────────────────────────
  trigger: {
    sectionAboutThem: 'About {anrede}',
    sectionAboutUs: 'About us two',
    sectionAboutUsHeart: '❤',
    sectionAboutUsHint: 'These questions go deeper – take your time with them.',
    typeMyOwn: 'Compose your own question',
  },

  // ── Composer (Screen 4) ────────────────────────────────────────────
  composer: {
    triggerChipLabel: 'Topic',
    backToTriggers: 'Different topic',
    seedLabel: 'What comes to mind? A keyword is enough.',
    seedHelper: 'Suggestions appear below based on your keyword.',
    seedPlaceholders: [
      'the hungry years',
      'Uncle Karl',
      'when you were young',
      'before I was born',
      'that old argument',
    ],
    suggestionsHeading: 'Suggestions',
    suggestionsHint: 'Pick a suggestion or tweak it.',
    suggestionUse: 'Use this',
    suggestionEdit: 'Edit',
    suggestionDiscardAria: 'Remove suggestion',
    inspirationToggle: 'One way to ask',
    inspirationHint: 'Tap an example to use it as your keyword.',
    freeformLabel: 'Your own question',
    freeformPlaceholder: 'Your question in your own words…',
    freeformHelper: 'Write the question exactly how you would ask {anrede}.',
    discard: 'Cancel',
    addQuestion: 'Add question',
    addEmptyError: 'Please type a question or pick a suggestion.',
  },

  // ── Question list (Screen 5) ───────────────────────────────────────
  list: {
    title: 'Your questions for {anrede}',
    emptyHint: '5 is a good start – but 1 is enough.',
    addAnother: 'Add question',
    send: 'Send to {anrede}',
    triggerChipAria: 'Topic',
    editAria: 'Edit',
    moveUpAria: 'Move up',
    moveDownAria: 'Move down',
    deleteAria: 'Delete',
    confirmDelete: 'Remove this question?',
    confirmDeleteCancel: 'Cancel',
    confirmDeleteConfirm: 'Remove',
  },

  // ── Share / send (Screen 6) ────────────────────────────────────────
  share: {
    title: 'Send {anrede} your {count} questions',
    primaryCta: 'Send to {anrede}',
    sending: 'Opening…',
    copied: '✓ Link copied!',
    error: '⚠ Try again',
    privacyHint: "{anrede}'s answers stay on their device too.",
    relationshipHint:
      'Some of these are very personal. You might want to call {anrede} before sending.',
    backToList: 'Back to the list',
    shareMessage: "I wrote down a few questions for you ✨\n\n{url}",
    shareTitle: '{anrede}, I have questions for you',
    recipientPreviewHeading: '{anrede} will see this when they open the link:',
    recipientPreviewLines: [
      'A short greeting with your name.',
      'Your questions, one at a time.',
      'Answers via typing or voice – no app installation needed.',
    ],
    preferSimpleModeLabel: 'Pre-set large-text mode for {anrede}',
    preferSimpleModeHint: 'Recommended if {anrede} is hesitant with apps – only the essential buttons, large text. {anrede} can switch this later any time.',
  },

  // ── Receiver side ──────────────────────────────────────────────────
  receiver: {
    autoSuggestTitle: 'Would you like the simple version?',
    autoSuggestDesc:
      'We can switch the app to big text and only the most important buttons – ideal if you don\'t want to type much.',
    autoSuggestYes: 'Yes, simplify',
    autoSuggestNo: 'As usual',
    headerTitle: '{senderName} sent you {n} questions',
    headerSubline: 'In their words – you can record or type.',
    questionLabel: 'Question {n} of {total}',
    saveAndNextLabel: '✓ Save answer',
    saveAndNextAria: 'Save answer and continue to next question',
    skip: 'Answer later',
    next: 'Continue',
    done: 'Done',
    answerPlaceholder: 'Your answer…',
    progressDotAria: 'Question {n} of {total}',
    welcomeNameLabel: 'What\'s your name?',
    welcomeNamePlaceholder: 'Your name',
    welcomeStart: 'Begin',
  },

  // ── Friends-tab entry ──────────────────────────────────────────────
  entryCard: {
    title: 'Compose your own questions for someone',
    desc: 'Ask your own questions – in your own words, to Mom, Dad, Grandma. They answer when they\'re ready.',
    cta: 'Get started',
  },

  // ── Global ─────────────────────────────────────────────────────────
  back: '← Back',
}
