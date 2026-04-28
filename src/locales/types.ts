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
    /** "Tippe auf das Teilen-Symbol" / "Tap the Share icon" – iOS step 1 prefix. */
    iosStep1TapShareIcon: string
    /** "Wähle" / "Select" – iOS step 2 verb prefix. */
    iosStep2SelectVerb: string
    /** "Tippe auf" / "Tap" – iOS step 3 verb prefix. */
    iosStep3TapVerb: string
  }

  update: {
    title: string
    subtitle: string
    reload: string
    dismiss: string
  }

  releaseNotes: {
    title: string
    close: string
    viewNotes: string
    versionPrefix: string
  }

  reminder: {
    title: string
    desc: string
    allow: string
    dismiss: string
    settings: {
      title: string
      toggleLabel: string
      cadenceExplanation: string
      quietHours: string
      streakLabel: string
      streakCurrent: string
      streakLongest: string
      iosFallbackHint: string
      permissionDeniedHint: string
    }
    welcomeBack: {
      title: string
      bodyDays: string
      continueCta: string
      dismiss: string
    }
    milestone: {
      bodyAnswered: string
      bodyCategoryDone: string
    }
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
    /** Tags above the invite-link description. */
    tagOneTime: string
    tagNoAccount: string
    tagOffline: string
    /** Share-card metadata for the offline invite link. */
    inviteShareCardTitleWithName: string
    inviteShareCardTitleFallback: string
    inviteShareCardSubtitle: string
    /** Familienmodus opt-in section in the friends view. */
    familienmodusHeading: string
    familienmodusHint: string
    familienmodusTagPermanent: string
    familienmodusTagMutual: string
    familienmodusTagEncrypted: string
    familienmodusCtaSetup: string
    familienmodusCtaOpen: string
  }

  onlineSharingIntro: {
    back: string
    title: string
    heroAlt: string
    whatHeading: string
    whatBody1: string
    whatBody2Strong: string
    whatBody2Rest: string
    privacyHeading: string
    privacyBody: string
    privacyDetailsSummary: string
    tableWhat: string
    tableWhere: string
    tableForm: string
    row1What: string
    row1Where: string
    row1Form: string
    row2What: string
    row2Where: string
    row2Form: string
    row3What: string
    row3Where: string
    row3Form: string
    row4What: string
    row4Where: string
    row4Form: string
    row5What: string
    row5Where: string
    row5Form: string
    row6What: string
    row6Where: string
    row6Form: string
    deactivateHeading: string
    deactivateBody: string
    notConfiguredWarning: string
    consentLabel: string
    activateButton: string
  }

  contactHandshake: {
    cancel: string
    title: string
    /** Share-card subtitle reused for both contact-handshake and onboarding. */
    shareCardSubtitle: string
    /** "{name} lädt ein" / "{name} invites you" – share-card title used by
     *  ContactHandshakeView and OnlineSharingHubView. Uses {name}. */
    shareCardTitleWithName: string
    /** "{name} möchte Remember-Me-Erinnerungen mit dir teilen…" – uses {name}. */
    shareInviteText: string
    /** "{name} möchte sich mit dir verknüpfen. Öffne diesen Link:" – uses {name}. */
    shareBackText: string
    shareSheetTitle: string
    /** "möchte sich mit dir für Online-Erinnerungen verknüpfen." */
    introTextSuffix: string
    introTextDefaultName: string
    notEnabledHint: string
    enableButton: string
    connecting: string
    /** "{name} wurde in deiner Kontaktliste gespeichert …" – uses {name}. */
    savedHint: string
    savedHintDefaultName: string
    shareBackButton: string
    shareBackCopied: string
    doneButton: string
  }

  onlineSharingHub: {
    back: string
    title: string
    /** "Sync-Fehler: " prefix; concatenated with the raw error message. */
    syncErrorPrefix: string
    connecting: string

    tabs: {
      feed: string
      share: string
      contacts: string
      settings: string
    }

    onboarding: {
      heading: string
      hint: string
      shareCta: string
      copied: string
      step1: string
      step2: string
      step3: string
      settingsOpen: string
      settingsClose: string
    }

    feedEmpty: {
      hint: string
      shareCta: string
      inviteCta: string
    }

    annotation: {
      label: string
      placeholder: string
      sendButton: string
      sending: string
      sent: string
      error: string
    }

    share: {
      needsAnswerHint: string
      whichMemoryLabel: string
      memoryListAriaLabel: string
      whichRecipientLabel: string
      recipientListAriaLabel: string
      sendButton: string
      sendingButton: string
      sentButton: string
      timeoutMessage: string
      unknownError: string
    }

    contacts: {
      linkHeading: string
      linkHint: string
      shareLinkButton: string
      copied: string
      contactsHeading: string
      noContactsHint: string
    }

    settings: {
      heading: string
      hint: string
      deactivateButton: string
      confirmStrong: string
      confirmRest: string
      confirmYes: string
      confirmNo: string
    }
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
    /** ARIA label for the theme switcher group. */
    chooseAriaLabel: string
  }

  seo: {
    /** Per-route page title and meta description. Keys must match the
     *  `viewName` argument passed to the SEOHead component. */
    home: { title: string; description: string }
    archive: { title: string; description: string }
    friends: { title: string; description: string }
    profile: { title: string; description: string }
    feature: { title: string; description: string }
    faq: { title: string; description: string }
  }

  errorBoundary: {
    heading: string
    body: string
    reloadButton: string
  }

  logo: {
    /** Tagline shown under the logo on the hero / header. */
    tagline: string
  }

  media: {
    /** MediaCapture toolbar / hint copy. */
    introHint: string
    waitingMicrophone: string
    stopRecording: string
    cancelRecording: string
    cancelRecordingAria: string
    transcriptionLabel: string
    noTranscriptionHint: string
    noTranscriptionHintInBrowser: string
    whichTextLabel: string
    chooseNewTranscription: string
    chooseKeepText: string
    saveAudioFileLabel: string
    confirmAccept: string
    retryRecord: string
    discardRecord: string
    replaceRecording: string
    replaceRecordingAlt: string
    deleteRecording: string
    /** Toolbar buttons in MediaCapture. */
    toolbarAriaLabel: string
    photoLabel: string
    photoTooltipAdd: string
    photoTooltipMax: string
    photoAriaAdd: string
    photoAriaCount: string
    videoLabel: string
    videoTooltipAdd: string
    videoTooltipMax: string
    videoAriaAdd: string
    videoAriaCount: string
    audioLabel: string
    audioWaitLabel: string
    audioStartTitle: string
    audioStartAria: string
    audioExistingTitle: string
    audioExistingAria: string
    /** AudioRecorder standalone-button. */
    audioRecordButton: string
    audioWaitButton: string
    /** VideoAttachment lightbox + thumb buttons. */
    videoPlayAria: string
    videoRemoveAria: string
    videoLightboxCloseAria: string
    videoAddButton: string
    /** ImageAttachment ARIA labels + image-lightbox texts. */
    imageZoomAria: string
    imageLoadingAria: string
    imageRemoveAria: string
    imageLightboxAria: string
    imageLightboxCloseAria: string
    /** AudioPlayer fallback when blob can't be loaded. */
    audioUnavailable: string
  }

  categories: Category[]
  friendTopics: FriendTopic[]
}
