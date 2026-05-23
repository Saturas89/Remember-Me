import { useState, useEffect } from 'react'
import { useTranslation } from '../locales'
import {
  formatRecoveryCode,
  generateRecoveryCode,
  deriveVaultKey,
  cacheVaultKey,
  clearCachedVaultKey,
  cacheKdfParams,
  freshKdfParams,
  legacyKdfParams,
  type KdfParams,
} from '../utils/recoveryCode'
import { getSyncSupabaseClient } from '../utils/privateSyncClient'
import type { SyncProviderType } from '../types'

type Step =
  | 'intro'
  | 'provider-choice'
  | 'account-mode'
  | 'login'
  | 'pending-email-confirmation'
  | 'recovery-code'
  | 'enter-code'
  | 'success'

type AuthMode = 'signin' | 'signup'

// Supabase returns this error code on signInWithPassword when the user exists
// but never clicked the verification link. We route those users to the same
// waiting screen as a fresh signUp so the next step is obvious.
const EMAIL_NOT_CONFIRMED_CODE = 'email_not_confirmed'

const KNOWN_WEBMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'hotmail.de', 'live.com', 'live.de', 'msn.com',
  'yahoo.com', 'yahoo.de',
  'icloud.com', 'me.com', 'mac.com',
  'web.de',
  'gmx.de', 'gmx.net', 'gmx.com', 'gmx.at', 'gmx.ch',
  't-online.de', 'freenet.de', 'posteo.de', 'mailbox.org',
  'proton.me', 'protonmail.com', 'protonmail.ch',
  'tutanota.com', 'tutanota.de', 'tuta.io',
])

interface Props {
  onComplete: (provider: SyncProviderType, userId: string) => void
}

export function PrivateSyncSetupView({ onComplete }: Props) {
  const { t } = useTranslation()
  const s = t.privateSync

  const [step, setStep] = useState<Step>('intro')
  const [provider, setProvider] = useState<SyncProviderType | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Login state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Recovery code state
  const [recoveryCode, setRecoveryCode] = useState('')
  const [codeConfirmed, setCodeConfirmed] = useState(false)
  const [enteredCode, setEnteredCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [showLostKeyDialog, setShowLostKeyDialog] = useState(false)

  // userId after login
  const [userId, setUserId] = useState('')

  // Pending-email-confirmation state. `pendingUserId` is set when Supabase
  // creates the user but withholds a session until the email link is clicked;
  // we keep it separate from `userId` so we don't try to derive a vault key
  // before there's an authenticated session. `resendNotice` powers the small
  // status line under the resend button (success / cooldown / error).
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [resendNotice, setResendNotice] = useState<{ kind: 'sent' | 'error'; text: string } | null>(null)
  const [resending, setResending] = useState(false)

  // Resume Google Drive setup after Supabase OAuth redirect returns to /sync
  useEffect(() => {
    const PENDING_KEY = 'rm-gdrive-oauth-pending'
    if (!sessionStorage.getItem(PENDING_KEY)) return
    setProvider('google-drive')
    setStep('provider-choice')
    setLoading(true)
    ;(async () => {
      try {
        const { GoogleDriveProvider } = await import('../utils/googleDriveProvider')
        const p = new GoogleDriveProvider()
        const resumed = await p.resumeFromOAuth()
        if (!resumed) {
          setError('Google-Authentifizierung fehlgeschlagen')
          return
        }
        const existingSyncId = await p.readExistingSyncId()
        if (existingSyncId) {
          setUserId(existingSyncId)
          setStep('enter-code')
        } else {
          const newId = crypto.randomUUID()
          setUserId(newId)
          const code = generateRecoveryCode()
          setRecoveryCode(code)
          setStep('recovery-code')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen')
      } finally {
        setLoading(false)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGoogleSignIn() {
    if (!provider) return
    setLoading(true)
    setError(null)
    try {
      const { GoogleDriveProvider } = await import('../utils/googleDriveProvider')
      const p = new GoogleDriveProvider()
      await p.signIn()
      // Look for an existing encrypted sync file → drives whether the user
      // needs to enter their existing recovery code or generate a new one.
      const existingSyncId = await p.readExistingSyncId()
      if (existingSyncId) {
        setUserId(existingSyncId)
        setStep('enter-code')
      } else {
        const newId = crypto.randomUUID()
        setUserId(newId)
        const code = generateRecoveryCode()
        setRecoveryCode(code)
        setStep('recovery-code')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  async function handleMicrosoftSignIn() {
    if (!provider) return
    setLoading(true)
    setError(null)
    try {
      const { OneDriveProvider } = await import('../utils/oneDriveProvider')
      const p = new OneDriveProvider()
      await p.signIn()
      const existingSyncId = await p.readExistingSyncId()
      if (existingSyncId) {
        setUserId(existingSyncId)
        setStep('enter-code')
      } else {
        const newId = crypto.randomUUID()
        setUserId(newId)
        const code = generateRecoveryCode()
        setRecoveryCode(code)
        setStep('recovery-code')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  async function handleEmailSignIn() {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSyncSupabaseClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      // H4: NO fallback to signUp. A failed sign-in surfaces an error and
      // stays on the form; the user must explicitly switch to "Create
      // account" if they really want a new one.
      if (signInError) {
        // Supabase rejects an unconfirmed-email login with this exact code.
        // Send those users to the same waiting screen as a fresh sign-up so
        // they see "check your mail" instead of an opaque "Anmeldung
        // fehlgeschlagen".
        const code = (signInError as { code?: string }).code
        if (code === EMAIL_NOT_CONFIRMED_CODE) {
          setResendNotice(null)
          setStep('pending-email-confirmation')
          return
        }
        throw signInError
      }
      const uid = data.user?.id
      if (!uid) throw new Error('Kein User-ID nach Anmeldung')
      setUserId(uid)
      setStep('enter-code')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  async function handleEmailSignUp() {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSyncSupabaseClient()
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      // H4: NO fallback to signIn. If the account already exists, Supabase
      // returns an error and the user is told to switch to "Sign in" — no
      // silent re-use of an existing account.
      if (signUpError) throw signUpError
      const uid = data.user?.id
      if (!uid) throw new Error('Kein User-ID nach Registrierung')

      // When the Supabase project has "Confirm email" turned on, signUp
      // returns a user but no session — the user must click a link in the
      // verification email before we can derive a vault key or push state.
      // Park them on a dedicated wait screen; an onAuthStateChange listener
      // moves them on once the link is clicked and a SIGNED_IN event fires.
      if (!data.session) {
        setPendingUserId(uid)
        setResendNotice(null)
        setStep('pending-email-confirmation')
        return
      }

      setUserId(uid)
      const recoveryCodeValue = generateRecoveryCode()
      setRecoveryCode(recoveryCodeValue)
      setStep('recovery-code')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registrierung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  function openMailInbox() {
    const domain = email.split('@')[1]?.toLowerCase() ?? ''
    const webmailUrls: Record<string, string> = {
      'gmail.com': 'https://mail.google.com',
      'googlemail.com': 'https://mail.google.com',
      'outlook.com': 'https://outlook.live.com/mail/0/inbox',
      'hotmail.com': 'https://outlook.live.com/mail/0/inbox',
      'hotmail.de': 'https://outlook.live.com/mail/0/inbox',
      'live.com': 'https://outlook.live.com/mail/0/inbox',
      'live.de': 'https://outlook.live.com/mail/0/inbox',
      'msn.com': 'https://outlook.live.com/mail/0/inbox',
      'yahoo.com': 'https://mail.yahoo.com',
      'yahoo.de': 'https://mail.yahoo.com',
      'icloud.com': 'https://www.icloud.com/mail',
      'me.com': 'https://www.icloud.com/mail',
      'mac.com': 'https://www.icloud.com/mail',
      'web.de': 'https://web.de/email',
      'gmx.de': 'https://www.gmx.de',
      'gmx.net': 'https://www.gmx.net',
      'gmx.com': 'https://www.gmx.com',
      'gmx.at': 'https://www.gmx.at',
      'gmx.ch': 'https://www.gmx.ch',
      't-online.de': 'https://webmail.t-online.de',
      'freenet.de': 'https://webmail.freenet.de',
      'posteo.de': 'https://posteo.de/webmail',
      'mailbox.org': 'https://login.mailbox.org',
      'proton.me': 'https://mail.proton.me',
      'protonmail.com': 'https://mail.proton.me',
      'protonmail.ch': 'https://mail.proton.me',
      'tutanota.com': 'https://mail.tutanota.com',
      'tutanota.de': 'https://mail.tutanota.com',
      'tuta.io': 'https://mail.tutanota.com',
    }
    const url = webmailUrls[domain]
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    // Unknown domain: native mail app has no reliable inbox URL – do nothing,
    // the button is hidden for unknown providers (see JSX below).
  }

  async function handleResendConfirmation() {
    if (!email || resending) return
    setResending(true)
    setResendNotice(null)
    try {
      const supabase = getSyncSupabaseClient()
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
      if (resendError) throw resendError
      setResendNotice({ kind: 'sent', text: s.resendSuccess })
    } catch (e) {
      const msg = e instanceof Error ? e.message : s.resendError
      setResendNotice({ kind: 'error', text: msg })
    } finally {
      setResending(false)
    }
  }

  // Auto-advance from the wait screen once the Supabase email link is clicked.
  // With the PKCE flow the verification redirect lands back on /sync with a
  // `?code=...` that the SDK exchanges for a session and emits SIGNED_IN. We
  // only subscribe while on the wait screen so the listener is cheap and
  // self-contained.
  useEffect(() => {
    if (step !== 'pending-email-confirmation') return
    const supabase = getSyncSupabaseClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session?.user?.id) return
      // signUp path: user has not yet seen a recovery code — generate one
      // now and route through `recovery-code`. signIn path (came here from
      // email_not_confirmed): we go straight to `enter-code` because the
      // user already has an existing code.
      const uid = session.user.id
      setUserId(uid)
      if (pendingUserId) {
        const recoveryCodeValue = generateRecoveryCode()
        setRecoveryCode(recoveryCodeValue)
        setStep('recovery-code')
      } else {
        setStep('enter-code')
      }
      setPendingUserId(null)
      setResendNotice(null)
    })
    return () => { subscription.unsubscribe() }
  }, [step, pendingUserId])

  async function handleRecoveryCodeConfirm() {
    if (!provider) return
    setLoading(true)
    try {
      // H7: fresh random 16-byte salt + 600k iterations for any new setup.
      // The salt travels with the next sync envelope so a new device can
      // re-derive the same key from the recovery code.
      const params = freshKdfParams()
      const key = await deriveVaultKey(recoveryCode, params)
      await cacheVaultKey(userId, key)
      await cacheKdfParams(userId, params)
      onComplete(provider, userId)
    } catch {
      setError('Schlüssel konnte nicht gespeichert werden')
    } finally {
      setLoading(false)
    }
  }

  async function handleEnterCode() {
    if (!provider) return
    setCodeError(null)
    setLoading(true)
    try {
      const normalized = enteredCode.replace(/-/g, '').trim()

      // H7: fetch the envelope's kdf params first so we re-derive with the
      // same salt + iterations that the first device used. Legacy v2 rows
      // / envelopes (no salt) fall back to the old `salt = userId, 200_000`
      // params via `legacyKdfParams`.
      let params: KdfParams
      if (provider === 'supabase') {
        const supabase = getSyncSupabaseClient()
        const { data } = await supabase
          .from('private_sync_state')
          .select('salt')
          .eq('user_id', userId)
          .maybeSingle()
        if (data?.salt) {
          const saltBytes = Uint8Array.from(atob(data.salt as string), c => c.charCodeAt(0))
          params = { salt: saltBytes, iterations: 600_000 }
        } else {
          params = legacyKdfParams(userId)
        }
      } else if (provider === 'google-drive') {
        const { GoogleDriveProvider } = await import('../utils/googleDriveProvider')
        const probe = new GoogleDriveProvider(userId)
        const remoteKdf = await probe.readExistingKdfParams()
        params = remoteKdf ?? legacyKdfParams(userId)
      } else if (provider === 'onedrive') {
        const { OneDriveProvider } = await import('../utils/oneDriveProvider')
        const probe = new OneDriveProvider(userId)
        const remoteKdf = await probe.readExistingKdfParams()
        params = remoteKdf ?? legacyKdfParams(userId)
      } else {
        params = legacyKdfParams(userId)
      }

      const key = await deriveVaultKey(normalized, params)

      // Verify the entered code by trying to decrypt the existing payload.
      // Each provider has its own canonical "is this code right?" probe.
      if (provider === 'supabase') {
        await cacheVaultKey(userId, key)
        await cacheKdfParams(userId, params)
        const supabase = getSyncSupabaseClient()
        const { data } = await supabase
          .from('private_sync_state')
          .select('state_ct, state_iv')
          .eq('user_id', userId)
          .single()
        if (data) {
          const { decryptText } = await import('../utils/recoveryCode')
          // Throws on wrong key → caught below.
          await decryptText(data.state_ct as string, data.state_iv as string, key)
        }
      } else if (provider === 'google-drive') {
        await cacheVaultKey(userId, key)
        await cacheKdfParams(userId, params)
        const { GoogleDriveProvider } = await import('../utils/googleDriveProvider')
        const p = new GoogleDriveProvider(userId)
        // Pull will throw SyncError('decrypt') on a wrong code.
        await p.pull(
          { profile: null, answers: {}, friends: [], friendAnswers: [], customQuestions: [] },
          {
            getImageBlob: async () => null,
            getAudioBlob: async () => null,
            getVideoBlob: async () => null,
            putImage: async () => {},
            putAudio: async () => {},
            putVideo: async () => {},
            listLocalMediaIds: async () => ({ images: [], audio: [], videos: [] }),
          },
        )
      } else if (provider === 'onedrive') {
        await cacheVaultKey(userId, key)
        await cacheKdfParams(userId, params)
        const { OneDriveProvider } = await import('../utils/oneDriveProvider')
        const p = new OneDriveProvider(userId)
        await p.pull(
          { profile: null, answers: {}, friends: [], friendAnswers: [], customQuestions: [] },
          {
            getImageBlob: async () => null,
            getAudioBlob: async () => null,
            getVideoBlob: async () => null,
            putImage: async () => {},
            putAudio: async () => {},
            putVideo: async () => {},
            listLocalMediaIds: async () => ({ images: [], audio: [], videos: [] }),
          },
        )
      }
      onComplete(provider, userId)
    } catch {
      // Drop the cached key on a failed verification so the user can try again.
      await import('../utils/recoveryCode').then(m => m.clearCachedVaultKey(userId)).catch(() => {})
      setCodeError(s.enterCodeError)
    } finally {
      setLoading(false)
    }
  }

  async function handleLostKeyReset() {
    try { await clearCachedVaultKey(userId) } catch { /* best-effort */ }
    setEnteredCode('')
    setCodeError(null)
    setShowLostKeyDialog(false)
    setRecoveryCode(generateRecoveryCode())
    setStep('recovery-code')
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  if (step === 'intro') {
    return (
      <div className="private-sync-view">
        <img src="/features/privater-sync.jpg" alt="" className="familien-banner" aria-hidden="true" />
        <section className="friends-section">
          <h3 className="friends-section-title">{s.introTitle}</h3>
          <p className="friends-hint">{s.introDesc}</p>
          <div className="friends-share">
            <button
              className="share-cta-btn"
              onClick={() => setStep('provider-choice')}
              type="button"
            >
              {s.setupButton}
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (step === 'provider-choice') {
    // OneDrive support is fully implemented (handleMicrosoftSignIn below);
    // only the provider-choice card was missing — the Sandra persona caught
    // this stille Inkonsistenz in #175.
    const providers = [
      { id: 'google-drive' as SyncProviderType, title: s.googleDriveTitle, desc: s.googleDriveDesc, privacy: s.googleDrivePrivacy, icon: '☁️', colorClass: 'provider-card__icon--google' },
      { id: 'onedrive'     as SyncProviderType, title: s.oneDriveTitle,   desc: s.oneDriveDesc,   privacy: s.oneDrivePrivacy,   icon: '🪟', colorClass: 'provider-card__icon--onedrive' },
      { id: 'supabase'     as SyncProviderType, title: s.supabaseTitle,   desc: s.supabaseDesc,   privacy: s.supabasePrivacy,   icon: '🔒', colorClass: 'provider-card__icon--server' },
    ]
    const handleContinue = () => {
      if (provider === 'google-drive') return handleGoogleSignIn()
      if (provider === 'onedrive') return handleMicrosoftSignIn()
      if (provider === 'supabase') {
        // H4: explicit sign-up vs sign-in step. Without it, a typo'd password
        // on sign-in used to auto-create a brand-new account and orphan the
        // existing vault (plus a User-Enumeration side-channel).
        setAuthMode(null)
        setError(null)
        setStep('account-mode')
      }
    }
    return (
      <div className="private-sync-view">
        <div className="quiz-topbar">
          <button className="btn btn--ghost btn--sm" onClick={() => setStep('intro')} type="button">
            {s.back}
          </button>
          <h2 className="archive-title">{s.providerChoiceTitle}</h2>
        </div>
        {error && <p className="private-sync-view__error">{error}</p>}
        <section className="friends-section">
          <div className="private-sync-view__provider-list">
            {providers.map(p => (
              <button
                key={p.id}
                className={`provider-card${provider === p.id ? ' provider-card--selected' : ''}`}
                onClick={() => setProvider(p.id)}
                type="button"
                disabled={loading}
              >
                <span className={`provider-card__icon ${p.colorClass}`}>{p.icon}</span>
                <div className="provider-card__body">
                  <p className="provider-card__title">{p.title}</p>
                  <p className="provider-card__desc">{p.desc}</p>
                  <p className="provider-card__privacy">{p.privacy}</p>
                </div>
                {provider === p.id && (
                  <span className="provider-card__badge" aria-hidden="true">✓</span>
                )}
              </button>
            ))}
          </div>
          <div className="friends-share">
            <button
              className="share-cta-btn"
              disabled={!provider || loading}
              onClick={handleContinue}
              type="button"
            >
              {loading ? (
                <><span className="share-cta-btn__spinner" aria-hidden="true" />{s.signingIn}</>
              ) : (
                s.continueButton
              )}
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (step === 'account-mode') {
    const pick = (mode: AuthMode) => {
      setAuthMode(mode)
      setError(null)
      setStep('login')
    }
    return (
      <div className="private-sync-view">
        <div className="quiz-topbar">
          <button className="btn btn--ghost btn--sm" onClick={() => setStep('provider-choice')} type="button">
            {s.back}
          </button>
          <h2 className="archive-title">{s.accountModeTitle}</h2>
        </div>
        {error && <p className="private-sync-view__error">{error}</p>}
        <section className="friends-section">
          <p className="friends-hint">{s.accountModeDesc}</p>
          <div className="private-sync-view__provider-list">
            <button
              type="button"
              className="provider-card"
              onClick={() => pick('signin')}
              disabled={loading}
            >
              <span className="provider-card__icon provider-card__icon--server" aria-hidden="true">🔑</span>
              <div className="provider-card__body">
                <p className="provider-card__title">{s.accountModeExistingTitle}</p>
                <p className="provider-card__desc">{s.accountModeExistingDesc}</p>
              </div>
            </button>
            <button
              type="button"
              className="provider-card"
              onClick={() => pick('signup')}
              disabled={loading}
            >
              <span className="provider-card__icon provider-card__icon--server" aria-hidden="true">✨</span>
              <div className="provider-card__body">
                <p className="provider-card__title">{s.accountModeNewTitle}</p>
                <p className="provider-card__desc">{s.accountModeNewDesc}</p>
              </div>
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (step === 'login') {
    const isSignUp = authMode === 'signup'
    const handler = isSignUp ? handleEmailSignUp : handleEmailSignIn
    const title = isSignUp ? s.signUpTitle : s.loginTitle
    const buttonLabel = loading
      ? (isSignUp ? s.signingUp : s.signingIn)
      : (isSignUp ? s.signUpButton : s.signInButton)
    return (
      <div className="private-sync-view">
        <div className="quiz-topbar">
          <button className="btn btn--ghost btn--sm" onClick={() => setStep('account-mode')} type="button">
            {s.back}
          </button>
          <h2 className="archive-title">{title}</h2>
        </div>
        {error && <p className="private-sync-view__error">{error}</p>}
        <section className="friends-section">
          <div className="private-sync-view__form">
            <label className="profile-label">
              {s.emailLabel}
              <input
                className="profile-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={s.emailPlaceholder}
                autoComplete="email"
              />
            </label>
            <label className="profile-label">
              {s.passwordLabel}
              <input
                className="profile-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={s.passwordPlaceholder}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
            </label>
            <div className="friends-share">
              <button
                className="share-cta-btn"
                onClick={handler}
                disabled={loading || !email || !password}
                type="button"
              >
                {loading ? (
                  <><span className="share-cta-btn__spinner" aria-hidden="true" />{buttonLabel}</>
                ) : (
                  buttonLabel
                )}
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  if (step === 'pending-email-confirmation') {
    return (
      <div className="private-sync-view">
        <h2 className="private-sync-view__title">{s.pendingEmailTitle}</h2>
        <section className="friends-section">
          <p className="friends-hint">
            {s.pendingEmailDescPrefix}
            <strong>{email}</strong>
            {s.pendingEmailDescSuffix}
          </p>
          <p className="friends-hint">{s.pendingEmailHint}</p>

          {/* Show the webmail shortcut only for known providers – mailto: always
              opens a compose window, never the inbox, so we hide the button for
              unknown domains rather than confuse the user. */}
          {KNOWN_WEBMAIL_DOMAINS.has(email.split('@')[1]?.toLowerCase() ?? '') && (
            <div className="friends-share">
              <button
                className="share-cta-btn"
                type="button"
                onClick={openMailInbox}
                data-testid="pending-email-open-mail"
              >
                {s.pendingEmailOpenMailButton}
              </button>
            </div>
          )}

          <div className="friends-share">
            <button
              className="btn btn--ghost btn--full"
              onClick={handleResendConfirmation}
              disabled={resending || !email}
              type="button"
            >
              {resending ? (
                <><span className="share-cta-btn__spinner" aria-hidden="true" />{s.pendingEmailResending}</>
              ) : (
                s.pendingEmailResendButton
              )}
            </button>
          </div>

          {resendNotice && (
            <p
              className={
                resendNotice.kind === 'error'
                  ? 'friends-hint friends-hint--warn'
                  : 'friends-hint'
              }
            >
              {resendNotice.text}
            </p>
          )}

          <button
            type="button"
            className="btn btn--ghost btn--full"
            onClick={() => {
              setResendNotice(null)
              setPendingUserId(null)
              setStep('account-mode')
            }}
          >
            {s.pendingEmailBackToLogin}
          </button>
        </section>
      </div>
    )
  }

  if (step === 'recovery-code') {
    return (
      <div className="private-sync-view">
        <h2 className="private-sync-view__title">{s.recoveryCodeTitle}</h2>
        <section className="friends-section">
          {/* Persona-led copy reorder (#173): reassurance first, then the
              practical "what's it for" sentence, then the cautionary note
              (with explicit pointer to the REQ-018 lost-key safety net), and
              finally concrete storage suggestions. */}
          <p className="friends-hint">{s.recoveryCodeReassurance}</p>
          <p className="friends-hint">{s.recoveryCodeDesc}</p>
          <div className="private-sync-view__code-box">
            <code className="private-sync-view__code">{formatRecoveryCode(recoveryCode)}</code>
          </div>
          <p className="friends-hint">{s.recoveryCodeWarning}</p>
          <p className="friends-hint">{s.recoveryCodeAdvice}</p>
          <label className="private-sync-view__confirm-label">
            <input
              type="checkbox"
              checked={codeConfirmed}
              onChange={e => setCodeConfirmed(e.target.checked)}
            />
            <span>{s.recoveryCodeConfirm}</span>
          </label>
          <div className="friends-share">
            <button
              className="share-cta-btn"
              disabled={!codeConfirmed || loading}
              onClick={handleRecoveryCodeConfirm}
              type="button"
            >
              {loading ? (
                <><span className="share-cta-btn__spinner" aria-hidden="true" />{s.signingIn}</>
              ) : (
                s.continueButton
              )}
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (step === 'enter-code') {
    return (
      <div className="private-sync-view">
        <h2 className="private-sync-view__title">{s.enterCodeTitle}</h2>
        <section className="friends-section">
          <p className="friends-hint">{s.enterCodeDesc}</p>
          {codeError && <p className="private-sync-view__error">{codeError}</p>}
          <div className="private-sync-view__form">
            <label className="profile-label">
              {s.enterCodeLabel}
              <input
                className="profile-input private-sync-view__code-input"
                type="text"
                value={enteredCode}
                onChange={e => setEnteredCode(e.target.value)}
                placeholder={s.enterCodePlaceholder}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="friends-share">
              <button
                className="share-cta-btn"
                disabled={!enteredCode || loading}
                onClick={handleEnterCode}
                type="button"
              >
                {loading ? (
                  <><span className="share-cta-btn__spinner" aria-hidden="true" />{s.signingIn}</>
                ) : (
                  s.enterCodeButton
                )}
              </button>
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--full"
              onClick={() => setShowLostKeyDialog(true)}
            >
              {s.lostKeyLink}
            </button>
          </div>
        </section>
        {showLostKeyDialog && (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-box">
              <h3 className="modal-box__title">{s.lostKeyTitle}</h3>
              <p className="modal-box__body">{s.lostKeyBody}</p>
              <div className="modal-box__actions">
                <button
                  className="btn btn--danger btn--full"
                  onClick={handleLostKeyReset}
                  type="button"
                >
                  {s.lostKeyConfirm}
                </button>
                <button
                  className="btn btn--ghost btn--full"
                  onClick={() => setShowLostKeyDialog(false)}
                  type="button"
                >
                  {s.lostKeyCancel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // success
  return (
    <div className="private-sync-view">
      <section className="friends-section">
        <span className="private-sync-view__success-icon" aria-hidden="true">✅</span>
        <h2 className="private-sync-view__title">{s.successTitle}</h2>
        <p className="friends-hint">{s.successDesc}</p>
      </section>
    </div>
  )
}
