import type { Category, FriendTopic } from '../types'

export type Locale = 'de' | 'en'

export interface Translations {
  locale: Locale

  nav: {
    home: string
    friends: string
    archive: string
    features: string
    profile: string
  }

  global: {
    back: string
    save: string
    cancel: string
    opening: string
    copied: string
    messageCopied: string
    copyRetry: string
    edit: string
    enter: string
  }

  onboarding: {
    tagline: string
    story1: string
    story2: string
    featuresPrivateTitle: string
    featuresPrivateDesc: string
    featuresOfflineTitle: string
    featuresOfflineDesc: string
    featuresForeverTitle: string
    featuresForeverDesc: string
    nameLabel: string
    nameLabelHint: string
    namePlaceholder: string
    startButton: string
    alreadyUsed: string
    importButton: string
    footer: string
    confirmZip: string
    confirmJson: string
    preparing: string
    importSuccess: string
    importFailed: string
    photo: string
    photos: string
    video: string
    videos: string
    recording: string
    recordings: string
    restored: string
  }

  home: {
    appTitle: string
    greeting: string
    progress: string
    faqAriaLabel: string
    customCatTitle: string
    customCatDesc: string
    customCatDescEmpty: string
    customCatImgAlt: string
  }

  quiz: {
    backButton: string
  }

  questionCard: {
    questionOf: string
    textPlaceholder: string
    prevButton: string
    nextButton: string
    doneButton: string
    skipButton: string
  }

  profile: {
    pageTitle: string
    memberSince: string
    progressAriaLabel: string
    progressHeading: string
    answersLabel: string
    completedLabel: string
    friendsLabel: string
    daysLabel: string
    backupFresh: string
    backupStale: string
    backupOld: string
    backupNone: string
    profileHeading: string
    nameLabel: string
    namePlaceholder: string
    yearLabel: string
    yearPlaceholder: string
    historyHeading: string
    appearanceHeading: string
    importHeading: string
    socialTitle: string
    socialDesc: string
    formatsHeading: string
    formatsDesc: string
    markdownHint: string
    jsonHint: string
    restoreLabel: string
    restoreHint: string
    restoreButton: string
    faqTitle: string
    faqDesc: string
    confirmZip: string
    confirmJson: string
    preparing: string
    restoreSuccess: string
    restoreFailed: string
    importFailed: string
    photo: string
    photos: string
    video: string
    videos: string
    recording: string
    recordings: string
    restored: string
    langLabel: string
  }

  archiveExport: {
    title: string
    desc: string
    answersChip: string
    photosChip: string
    videosChip: string
    recordingsChip: string
    saveButton: string
    saved: string
    saveToDevice: string
    share: string
    saveAgain: string
    error: string
    retry: string
    shareTitle: string
    shareText: string
    photo: string
    photos: string
    video: string
    videos: string
    recording: string
    recordings: string
  }

  install: {
    ariaLabel: string
    ariaClose: string
    androidTitle: string
    androidDesc: string
    installNow: string
    notNow: string
    iosTitle: string
    iosDesc: string
    step1: string
    step2: string
    step3: string
    menuHint: string
    understand: string
  }

  update: {
    title: string
    subtitle: string
    reload: string
    dismiss: string
  }

  reminder: {
    title: string
    desc: string
    allow: string
    dismiss: string
  }

  friends: {
    pageTitle: string
    topbarTitle: string
    inviteLinkHeading: string
    inviteHintNoName: string
    inviteHint: string
    opening: string
    messageCopied: string
    copyRetry: string
    shareCta: string
    friendsFromHeading: string
    attachmentsHeading: string
    attachmentsHint: string
    openGift: string
    shareMessage: string
  }

  archiveView: {
    pageTitle: string
    title: string
    empty: string
    editPlaceholder: string
    save: string
    cancel: string
    deleteAudioAriaLabel: string
    editAnswerAriaLabel: string
    deleteAnswerAriaLabel: string
    confirmDeleteAnswer: string
    confirmDeleteEntry: string
    edited: string
    customSectionTitle: string
    importedFrom: string
    friendAnswersHeading: string
    friendsSectionTitle: string
    questionNotAvailable: string
  }

  customQ: {
    title: string
    intro: string
    addHeading: string
    titlePlaceholder: string
    addButton: string
    listHeading: string
    noAnswerYet: string
    answerPlaceholder: string
    save: string
    cancel: string
    deleteAriaLabel: string
    editLabel: string
    enterLabel: string
    shareHeading: string
    shareHint: string
    opening: string
    linkCopied: string
    shareRetry: string
    shareCta: string
    importHeading: string
    importPlaceholder: string
    importButton: string
    importSuccess: string
    importFailed: string
  }

  faq: {
    topbarTitle: string
    intro: string
    footer: string
    sections: Array<{
      emoji: string
      title: string
      items: Array<{ q: string; a: string }>
    }>
  }

  feature: {
    back: string
    futureFeatureLabel: string
    comingSoonTitle: string
    comingSoonDesc: string
    feedbackNote: string
    listTitle: string
    listIntro: string
    listNote: string
    features: Array<{
      id: string
      title: string
      subtitle: string
      img: string
      description: string
      status: string
    }>
  }

  friendAnswer: {
    welcomeIcon: string
    welcomeTitle: string
    welcomeText: string
    nameLabel: string
    namePlaceholder: string
    startButton: string
    topicHeading: string
    back: string
    doneIcon: string
    doneTitle: string
    doneText: string
    shareButton: string
    shareOpening: string
    shareCopied: string
    shareRetry: string
    textOnlyShare: string
    shareWithAttachments: string
    buildingAttachments: string
    shareTextOnly: string
    shareError: string
    ownCtaText: string
    ownCtaLink: string
    ownCtaImgAlt: string
  }

  backupAge: {
    today: string
    yesterday: string
    daysAgo: string
    weekAgo: string
    weeksAgo: string
    monthAgo: string
    monthsAgo: string
  }

  themes: {
    nacht: string
    hell: string
    sepia: string
    ozean: string
  }

  categories: Category[]
  friendTopics: FriendTopic[]
}
