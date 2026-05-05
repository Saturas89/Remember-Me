import { useState } from 'react'
import { useTranslation } from '../locales'
import { formatRecoveryCode, generateRecoveryCode, deriveVaultKey, cacheVaultKey } from '../utils/recoveryCode'
import { getSyncSupabaseClient } from '../utils/privateSyncClient'
import type { SyncProviderType } from '../types'

type Step =
  | 'intro'
  | 'provider-choice'
  | 'login'
  | 'recovery-code'
  | 'enter-code'
  | 'success'

interface Props {
  onComplete: (provider: SyncProviderType, userId: string) => void
}

export function PrivateSyncSetupView({ onComplete }: Props) {
  const { t } = useTranslation()
  const s = t.privateSync

  const [step, setStep] = useState<Step>('intro')
  const [provider, setProvider] = useState<SyncProviderType | null>(null)
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

  // userId after login
  const [userId, setUserId] = useState('')

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
      if (signInError) {
        // Try sign-up if sign-in fails (new account)
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        const uid = signUpData.user?.id
        if (!uid) throw new Error('Kein User-ID nach Registrierung')
        setUserId(uid)
      } else {
        const uid = data.user?.id
        if (!uid) throw new Error('Kein User-ID nach Anmeldung')
        setUserId(uid)
        // Existing account → needs code entry
        setStep('enter-code')
        return
      }
      // New account → show recovery code
      const code = generateRecoveryCode()
      setRecoveryCode(code)
      setStep('recovery-code')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecoveryCodeConfirm() {
    if (!provider) return
    setLoading(true)
    try {
      const key = await deriveVaultKey(recoveryCode, userId)
      await cacheVaultKey(userId, key)
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
      const key = await deriveVaultKey(normalized, userId)

      // Verify the entered code by trying to decrypt the existing payload.
      // Each provider has its own canonical "is this code right?" probe.
      if (provider === 'supabase') {
        await cacheVaultKey(userId, key)
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

  // ── Screens ───────────────────────────────────────────────────────────────

  if (step === 'intro') {
    return (
      <div className="private-sync-view">
        <div className="private-sync-view__hero">
          <img src="/features/privater-sync.jpg" alt="" className="private-sync-view__hero-img" />
        </div>
        <div className="private-sync-view__content">
          <h1 className="private-sync-view__title">{s.introTitle}</h1>
          <p className="private-sync-view__desc">{s.introDesc}</p>
          <button
            className="btn btn--primary btn--full"
            onClick={() => setStep('provider-choice')}
            type="button"
          >
            {s.setupButton}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'provider-choice') {
    return (
      <div className="private-sync-view">
        <div className="private-sync-view__topbar">
          <button className="btn btn--ghost btn--sm" onClick={() => setStep('intro')} type="button">
            {s.back}
          </button>
        </div>
        <div className="private-sync-view__content">
          <h2 className="private-sync-view__title">{s.providerChoiceTitle}</h2>
          <div className="private-sync-view__provider-list">
            {(
              [
                { id: 'google-drive' as SyncProviderType, title: s.googleDriveTitle, desc: s.googleDriveDesc, privacy: s.googleDrivePrivacy, icon: '🟢' },
                { id: 'onedrive' as SyncProviderType, title: s.oneDriveTitle, desc: s.oneDriveDesc, privacy: s.oneDrivePrivacy, icon: '🔵' },
                { id: 'supabase' as SyncProviderType, title: s.supabaseTitle, desc: s.supabaseDesc, privacy: s.supabasePrivacy, icon: '🔐' },
              ] as const
            ).map(p => (
              <button
                key={p.id}
                className={`private-sync-view__provider-card${provider === p.id ? ' private-sync-view__provider-card--selected' : ''}`}
                onClick={() => setProvider(p.id)}
                type="button"
              >
                <span className="private-sync-view__provider-icon">{p.icon}</span>
                <div className="private-sync-view__provider-info">
                  <strong>{p.title}</strong>
                  <p>{p.desc}</p>
                  <p className="private-sync-view__privacy-hint">{p.privacy}</p>
                </div>
              </button>
            ))}
          </div>
          <button
            className="btn btn--primary btn--full"
            disabled={!provider}
            onClick={() => setStep('login')}
            type="button"
          >
            {s.continueButton}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'login') {
    return (
      <div className="private-sync-view">
        <div className="private-sync-view__topbar">
          <button className="btn btn--ghost btn--sm" onClick={() => setStep('provider-choice')} type="button">
            {s.back}
          </button>
        </div>
        <div className="private-sync-view__content">
          <h2 className="private-sync-view__title">{s.loginTitle}</h2>
          {error && <p className="private-sync-view__error">{error}</p>}

          {provider === 'google-drive' && (
            <button
              className="btn btn--oauth btn--full"
              onClick={handleGoogleSignIn}
              disabled={loading}
              type="button"
            >
              {loading ? s.signingIn : s.googleSignInButton}
            </button>
          )}

          {provider === 'onedrive' && (
            <button
              className="btn btn--oauth btn--full"
              onClick={handleMicrosoftSignIn}
              disabled={loading}
              type="button"
            >
              {loading ? s.signingIn : s.microsoftSignInButton}
            </button>
          )}

          {provider === 'supabase' && (
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
                  autoComplete="current-password"
                />
              </label>
              <button
                className="btn btn--primary btn--full"
                onClick={handleEmailSignIn}
                disabled={loading || !email || !password}
                type="button"
              >
                {loading ? s.signingIn : s.signInButton}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (step === 'recovery-code') {
    return (
      <div className="private-sync-view">
        <div className="private-sync-view__content">
          <h2 className="private-sync-view__title">{s.recoveryCodeTitle}</h2>
          <p className="private-sync-view__desc">{s.recoveryCodeDesc}</p>
          <div className="private-sync-view__code-box">
            <code className="private-sync-view__code">{formatRecoveryCode(recoveryCode)}</code>
          </div>
          <p className="private-sync-view__warning">{s.recoveryCodeWarning}</p>
          <label className="private-sync-view__confirm-label">
            <input
              type="checkbox"
              checked={codeConfirmed}
              onChange={e => setCodeConfirmed(e.target.checked)}
            />
            <span>{s.recoveryCodeConfirm}</span>
          </label>
          <button
            className="btn btn--primary btn--full"
            disabled={!codeConfirmed || loading}
            onClick={handleRecoveryCodeConfirm}
            type="button"
          >
            {loading ? s.signingIn : s.continueButton}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'enter-code') {
    return (
      <div className="private-sync-view">
        <div className="private-sync-view__content">
          <h2 className="private-sync-view__title">{s.enterCodeTitle}</h2>
          <p className="private-sync-view__desc">{s.enterCodeDesc}</p>
          {codeError && <p className="private-sync-view__error">{codeError}</p>}
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
          <button
            className="btn btn--primary btn--full"
            disabled={!enteredCode || loading}
            onClick={handleEnterCode}
            type="button"
          >
            {loading ? s.signingIn : s.enterCodeButton}
          </button>
        </div>
      </div>
    )
  }

  // success
  return (
    <div className="private-sync-view">
      <div className="private-sync-view__content private-sync-view__content--center">
        <span className="private-sync-view__success-icon" aria-hidden="true">✅</span>
        <h2 className="private-sync-view__title">{s.successTitle}</h2>
        <p className="private-sync-view__desc">{s.successDesc}</p>
      </div>
    </div>
  )
}
