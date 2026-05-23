export const FAQ_EN = [
  {
    emoji: '🔒',
    title: 'Privacy & Data Protection',
    items: [
      {
        q: 'Are my memories uploaded to a server?',
        a: 'No – and that is exactly the intention. Your story belongs to you alone. All answers, photos and voice recordings stay exclusively on your device. Storyhold works completely without its own servers – your memories go nowhere you haven\'t sent them.',
      },
      {
        q: 'Who can see my memories?',
        a: 'Nobody but you. There is no account, no login, and no central storage. Your story is as private as a handwritten diary – other people on the same device would need direct access to your browser profile to read it.',
      },
      {
        q: 'What happens to my memories if I clear the browser cache?',
        a: '"Clear browsing data" removes all locally stored content in most browsers – which would permanently delete your memories too. Therefore, regularly create a memory archive under Profile → Back up & share. That\'s the only way your stories truly stay preserved.',
      },
      {
        q: 'Are my photos and voice recordings safe?',
        a: 'Yes. Photos and recordings never leave your browser. They are stored locally on your device – nobody else has access to them, not even us. Your moments stay your moments.',
      },
      {
        q: 'Does speech recognition use external servers?',
        a: 'Speech recognition uses your browser\'s dictation feature. In Chrome and Edge this may mean audio is briefly sent to Google or Microsoft – just like normal dictation. The saved recording itself always stays locally on your device. You can simply ignore the transcription and just use your original voice.',
      },
      {
        q: 'Why is Storyhold released under the AGPL license?',
        a: 'We want to back up a promise, not just marketing: Storyhold stays open. You can inspect the source code on GitHub and verify for yourself that your life story stays private – and you can even self-host Storyhold if you want to. On top of that, the AGPL-3.0 license makes sure future versions stay open too, even if somebody else takes over running Storyhold.',
      },
      {
        q: 'Does the app use analytics software?',
        a: 'Yes – Storyhold uses PostHog (EU servers, Frankfurt) for anonymous usage analysis: which features are used and how often, device category, app version. No content from your memories is collected, no cookies are set, and IP addresses are not stored permanently. There is currently no built-in opt-out. Anyone who wants to block this entirely can enable tracking protection in their browser settings.',
      },
      {
        q: 'How do I delete all my data?',
        a: 'Go to Profile → scroll to the very bottom → "Delete all data". This permanently removes all local data (answers, photos, recordings, settings). If cloud sync is active, the cloud data is deleted too. The app then restarts as if opened for the first time.',
      },
    ],
  },
  {
    emoji: '📥',
    title: 'Importing',
    items: [
      {
        q: 'How do I import my Instagram data?',
        a: 'Go to Profile → Import → Social Media. There you will find a simple step-by-step guide on how to request and upload your Instagram data. Storyhold reads your posts and suggests turning them into answers – old moments become lasting memories.',
      },
      {
        q: 'How do I restore saved memories?',
        a: 'Go to Profile → Load backup. Select your saved archive file. All current content will be replaced – the dialog will ask you to confirm before anything is changed.',
      },
      {
        q: 'Are photos and recordings included in the archive?',
        a: 'Yes – when you create the full memory archive (ZIP file), photos and voice recordings are included. The simple JSON backup only contains text. For a complete move to a new device, we always recommend the ZIP archive.',
      },
      {
        q: 'What happens to my existing memories when restoring?',
        a: 'They are replaced by the state of the backup file. If you want to keep both, create a current archive first – then no memories will be lost.',
      },
    ],
  },
  {
    emoji: '📤',
    title: 'Backing Up & Sharing',
    items: [
      {
        q: 'How do I back up my memories?',
        a: 'Go to Profile → Back up & share. With one tap you create a complete memory archive – all texts, photos, and recordings in a single file. Save it to your device or share it directly with someone your story belongs to.',
      },
      {
        q: 'What is the difference between the archive and a JSON export?',
        a: 'The archive (ZIP) contains everything: texts, photos and voice recordings – designed for permanent preservation and sharing. The JSON export is a structured text export for technical purposes, e.g. for AI assistants or further processing.',
      },
      {
        q: 'How do I transfer my memories to a new device?',
        a: 'Create a memory archive under Profile → Back up & share. Transfer the file to the new device (via AirDrop, email, or cloud). Open Storyhold on the new device and load the archive – all your memories are back, as if you never left.',
      },
      {
        q: 'How do I open my data via Sync on a second device (e.g. PC)?',
        a: 'Prerequisite: You\'ve set up Sync on your first device and know your recovery code. On the new device: 1) Open Storyhold in your browser (same address as on your phone). 2) Tap "Set up sync" and choose the same provider as on the first device (Google Drive, OneDrive, or Storyhold Server). 3) Sign in with the same account as before. 4) Wait briefly – Storyhold automatically looks for your existing data. 5) When the "Enter recovery code" field appears, type the code from your first device and confirm. Done – your memories are now on the new device too. ⚠️ Important: If the new device shows a new recovery code instead, cancel – you\'re signed in with the wrong account. Otherwise you\'ll overwrite your existing data.',
      },
      {
        q: 'Can I use my memories in other apps?',
        a: 'Yes. The Markdown export can be used in note apps, Word, or as input for AI assistants (e.g. ChatGPT). The JSON export is suitable for structured further processing or for developers who want to build on your content.',
      },
    ],
  },
  {
    emoji: '👥',
    title: 'Friends & Family Mode',
    items: [
      {
        q: 'What is the "One-time invitation"?',
        a: 'You share a personal link – the recipient clicks it, types in their memories and sends them back to you. No account, no app, no hassle. You can send the link as many times as you like and to as many people as you want. Each response is a single connection – once answered, it\'s complete.',
      },
      {
        q: 'What is Family Mode?',
        a: 'Family Mode creates a permanent, mutual connection between two people. You each exchange a connection link once – after that you can send each other selected memories at any time, which only the two of you can read. Everything is end-to-end encrypted and stays on your devices.',
      },
      {
        q: 'What is the difference between One-time invitation and Family Mode?',
        a: 'The One-time invitation is open and anonymous: you send a link, someone responds – no account needed, no lasting connection. Family Mode is permanent and mutual: after a one-time setup, you can continuously exchange private memories. In short: One-time invitation = quickly collect a response, Family Mode = ongoing private exchange.',
      },
    ],
  },
]
