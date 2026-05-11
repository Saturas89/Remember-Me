import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { PrivateSyncSetupView } from './PrivateSyncSetupView'

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../utils/recoveryCode', () => ({
  generateRecoveryCode: vi.fn(() => 'AAAABBBBCCCCDDDDEEEEFFFF'),
  formatRecoveryCode: vi.fn((c: string) =>
    c.match(/.{1,4}/g)?.join('-') ?? c,
  ),
  deriveVaultKey: vi.fn(async () => ({} as CryptoKey)),
  cacheVaultKey: vi.fn(async () => {}),
  clearCachedVaultKey: vi.fn(async () => {}),
  decryptText: vi.fn(async () => '{}'),
}))

// Stable mock client — every call to getSyncSupabaseClient() must return
// the SAME `auth.signInWithPassword` / `auth.signUp` spies so per-test
// `mockResolvedValueOnce` overrides actually stick (H4 needs the spies to
// survive across the multi-step wizard).
// Captures the latest auth-state listener so tests can simulate the
// "user clicked the email link → SIGNED_IN" event without going through
// the Supabase SDK's real redirect plumbing.
type AuthCb = (event: string, session: { user?: { id: string } } | null) => void
let lastAuthCb: AuthCb | null = null

const mockSupabase = {
  auth: {
    signInWithPassword: vi.fn(async () => ({
      data: { user: { id: 'test-user-id' }, session: { user: { id: 'test-user-id' } } },
      error: null,
    })),
    signUp: vi.fn(async () => ({
      // Default: a session is returned, so the wizard skips the
      // pending-email-confirmation step. Tests that need the wait state
      // override this with `mockResolvedValueOnce({ session: null })`.
      data: { user: { id: 'test-user-id' }, session: { user: { id: 'test-user-id' } } },
      error: null,
    })),
    resend: vi.fn(async () => ({ data: {}, error: null })),
    onAuthStateChange: vi.fn((cb: AuthCb) => {
      lastAuthCb = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({ single: vi.fn(async () => ({ data: null })) }),
    }),
  }),
}

vi.mock('../utils/privateSyncClient', () => ({
  getSyncSupabaseClient: () => mockSupabase,
}))

// ── Locale-agnostic regex helpers ────────────────────────────────────────────
//
// Default locale auto-detects (DE for German browsers/timezones, EN otherwise).
// Vitest+jsdom typically resolves to EN via navigator.language='en-US', but to
// keep the test robust against alternative CI locales we use regex-OR for every
// user-facing string per spec §12.2 / §12.4.

const RX = {
  setupButton: /Einrichten|Set up/,
  supabaseTitle: /Storyhold Server/,
  continueButton: /Weiter|Continue/,
  emailLabel: /E-?Mail|Email/i,
  passwordLabel: /Passwort|Password/,
  signInButton: /^Anmelden$|^Sign in$/,
  enterCodeTitle: /Sicherheitsschlüssel eingeben|Enter security key/,
  lostKeyLink: /Schlüssel verloren\?|Lost your key\?/,
  lostKeyTitle: /Sicherheitsschlüssel verloren|Security key lost/,
  lostKeyConfirm: /Neu starten|Start fresh/,
  lostKeyCancel: /^Abbrechen$|^Cancel$/,
}

// ── Test setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  lastAuthCb = null
})

/**
 * Drive the wizard from `intro` → `enter-code` via the Supabase login path.
 * The mocked `signInWithPassword` resolves with `test-user-id`, which the
 * component treats as an existing account and auto-jumps to `enter-code`.
 */
async function gotoEnterCode() {
  render(<PrivateSyncSetupView onComplete={vi.fn()} />)

  // intro → provider-choice
  fireEvent.click(await screen.findByRole('button', { name: RX.setupButton }))

  // provider-choice: select Supabase card, then Continue
  const providerCard = await screen.findByRole('button', { name: new RegExp(RX.supabaseTitle.source) })
  fireEvent.click(providerCard)
  // The "Continue" button only enables after a provider is selected.
  const continueBtn = await screen.findByRole<HTMLButtonElement>('button', { name: RX.continueButton })
  await waitFor(() => expect(continueBtn.disabled).toBe(false))
  fireEvent.click(continueBtn)

  // H4: account-mode step now sits between provider-choice and login. The
  // mocked signIn returns success, so we pick the "existing account" card.
  const existingAccountBtn = await screen.findByRole<HTMLButtonElement>(
    'button', { name: /Ja, ich melde mich an|Yes, sign me in/ },
  )
  fireEvent.click(existingAccountBtn)

  // login: fill email + password, click sign in
  const emailInput = await screen.findByLabelText(RX.emailLabel)
  const passwordInput = await screen.findByLabelText(RX.passwordLabel)
  fireEvent.change(emailInput, { target: { value: 'foo@example.com' } })
  fireEvent.change(passwordInput, { target: { value: 'hunter2hunter2' } })

  const signInBtn = await screen.findByRole<HTMLButtonElement>('button', { name: RX.signInButton })
  await waitFor(() => expect(signInBtn.disabled).toBe(false))
  fireEvent.click(signInBtn)

  // Wait until enter-code screen is mounted.
  await screen.findByText(RX.enterCodeTitle)
}

// ── Tests ────────────────────────────────────────────────────────────────────

// ── H4: separate sign-up / sign-in ────────────────────────────────────────

describe('PrivateSyncSetupView – H4 sign-up vs sign-in', () => {
  it('H4-01: sign-in failure does NOT auto-create an account', async () => {
    const { getSyncSupabaseClient } = await import('../utils/privateSyncClient')
    const supabase = getSyncSupabaseClient() as unknown as {
      auth: {
        signInWithPassword: ReturnType<typeof vi.fn>
        signUp: ReturnType<typeof vi.fn>
      }
    }
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('Invalid login credentials'),
    })

    render(<PrivateSyncSetupView onComplete={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: RX.setupButton }))
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(RX.supabaseTitle.source) }))
    fireEvent.click(await screen.findByRole<HTMLButtonElement>('button', { name: RX.continueButton }))
    fireEvent.click(await screen.findByRole<HTMLButtonElement>('button', { name: /Ja, ich melde mich an|Yes, sign me in/ }))

    fireEvent.change(await screen.findByLabelText(RX.emailLabel), { target: { value: 'foo@example.com' } })
    fireEvent.change(await screen.findByLabelText(RX.passwordLabel), { target: { value: 'wrong-password' } })
    fireEvent.click(await screen.findByRole('button', { name: RX.signInButton }))

    // The error message is shown on the login step.
    await screen.findByText(/Invalid login credentials/i)
    // Crucially: signUp was NEVER called as a fallback.
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
    // We're still on the login step — the recovery-code heading must not
    // appear (that would mean an account got silently created).
    expect(screen.queryByText(/Dein Sicherheitsschlüssel|Your security key/)).toBeNull()
  })

  it('H4-02: explicit sign-up path lands on the recovery-code screen', async () => {
    const { getSyncSupabaseClient } = await import('../utils/privateSyncClient')
    const supabase = getSyncSupabaseClient() as unknown as {
      auth: {
        signInWithPassword: ReturnType<typeof vi.fn>
        signUp: ReturnType<typeof vi.fn>
      }
    }
    supabase.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'new-user-id' }, session: { user: { id: 'new-user-id' } } },
      error: null,
    })

    render(<PrivateSyncSetupView onComplete={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: RX.setupButton }))
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(RX.supabaseTitle.source) }))
    fireEvent.click(await screen.findByRole<HTMLButtonElement>('button', { name: RX.continueButton }))
    fireEvent.click(await screen.findByRole<HTMLButtonElement>('button', { name: /Nein, neues Konto erstellen|No, create a new account/ }))

    fireEvent.change(await screen.findByLabelText(RX.emailLabel), { target: { value: 'new@example.com' } })
    fireEvent.change(await screen.findByLabelText(RX.passwordLabel), { target: { value: 'a-fresh-password' } })
    fireEvent.click(await screen.findByRole('button', { name: /^Konto erstellen$|^Create account$/ }))

    await screen.findByText(/Dein Sicherheitsschlüssel|Your security key/)
    // signInWithPassword must NOT have been touched on the sign-up path.
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
    expect(supabase.auth.signUp).toHaveBeenCalledOnce()
  })
})

describe('PrivateSyncSetupView – Lost-Key reset (REQ-018)', () => {
  it('L-01: shows the lost-key link on the enter-code step', async () => {
    await gotoEnterCode()
    expect(
      await screen.findByRole('button', { name: RX.lostKeyLink }),
    ).not.toBeNull()
  })

  it('L-02: cancel closes the modal without resetting state', async () => {
    await gotoEnterCode()

    fireEvent.click(screen.getByRole('button', { name: RX.lostKeyLink }))

    // Modal opens.
    const dialog = await screen.findByRole('dialog')
    expect(dialog).not.toBeNull()
    expect(screen.getByText(RX.lostKeyTitle)).not.toBeNull()

    // Cancel.
    fireEvent.click(screen.getByRole('button', { name: RX.lostKeyCancel }))

    // Modal gone, still on enter-code (input field present).
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText(RX.enterCodeTitle)).not.toBeNull()
  })

  it('L-03: confirm clears cached key, generates new code, jumps to recovery-code', async () => {
    const { clearCachedVaultKey, generateRecoveryCode } = await import('../utils/recoveryCode')

    await gotoEnterCode()

    fireEvent.click(screen.getByRole('button', { name: RX.lostKeyLink }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: RX.lostKeyConfirm }))

    // Mocked recovery code formatted as 4-char groups.
    expect(
      await screen.findByText('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF'),
    ).not.toBeNull()

    // Reset side effects.
    expect(vi.mocked(clearCachedVaultKey)).toHaveBeenCalledWith('test-user-id')
    expect(vi.mocked(generateRecoveryCode)).toHaveBeenCalled()

    // Lost-key link is no longer rendered (we left the enter-code step).
    expect(
      screen.queryByRole('button', { name: RX.lostKeyLink }),
    ).toBeNull()
  })
})

// ── Pending email confirmation flow ─────────────────────────────────────────

const RX_PENDING = {
  title: /Bestätige deine E-Mail|Confirm your email/,
  resend: /Bestätigungs-Mail erneut senden|Resend confirmation email/,
  resendSuccess: /Mail wurde erneut gesendet|Email was sent again/,
  backToLogin: /Anders anmelden|Use a different account/,
  recoveryCodeTitle: /Dein Sicherheitsschlüssel|Your security key/,
  enterCodeTitle: /Sicherheitsschlüssel eingeben|Enter security key/,
}

async function gotoSignUpForm() {
  render(<PrivateSyncSetupView onComplete={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: RX.setupButton }))
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(RX.supabaseTitle.source) }))
  fireEvent.click(await screen.findByRole<HTMLButtonElement>('button', { name: RX.continueButton }))
  fireEvent.click(await screen.findByRole<HTMLButtonElement>(
    'button', { name: /Nein, neues Konto erstellen|No, create a new account/ },
  ))
  fireEvent.change(await screen.findByLabelText(RX.emailLabel), { target: { value: 'new@example.com' } })
  fireEvent.change(await screen.findByLabelText(RX.passwordLabel), { target: { value: 'a-fresh-password' } })
}

describe('PrivateSyncSetupView – pending email confirmation', () => {
  it('P-01: signUp with no session lands on the wait screen, not on recovery-code', async () => {
    const { getSyncSupabaseClient } = await import('../utils/privateSyncClient')
    const supabase = getSyncSupabaseClient() as unknown as {
      auth: { signUp: ReturnType<typeof vi.fn> }
    }
    supabase.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'new-user-id' }, session: null },
      error: null,
    })

    await gotoSignUpForm()
    fireEvent.click(await screen.findByRole('button', { name: /^Konto erstellen$|^Create account$/ }))

    await screen.findByText(RX_PENDING.title)
    // Recovery code must NOT be shown — that step is gated on a real session.
    expect(screen.queryByText(RX_PENDING.recoveryCodeTitle)).toBeNull()
  })

  it('P-02: resend button calls supabase.auth.resend and shows success notice', async () => {
    const { getSyncSupabaseClient } = await import('../utils/privateSyncClient')
    const supabase = getSyncSupabaseClient() as unknown as {
      auth: { signUp: ReturnType<typeof vi.fn>; resend: ReturnType<typeof vi.fn> }
    }
    supabase.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'new-user-id' }, session: null },
      error: null,
    })

    await gotoSignUpForm()
    fireEvent.click(await screen.findByRole('button', { name: /^Konto erstellen$|^Create account$/ }))
    await screen.findByText(RX_PENDING.title)

    fireEvent.click(screen.getByRole('button', { name: RX_PENDING.resend }))

    await waitFor(() => {
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'new@example.com',
      })
    })
    expect(await screen.findByText(RX_PENDING.resendSuccess)).not.toBeNull()
  })

  it('P-03: SIGNED_IN event auto-advances from wait screen to recovery-code', async () => {
    const { getSyncSupabaseClient } = await import('../utils/privateSyncClient')
    const supabase = getSyncSupabaseClient() as unknown as {
      auth: { signUp: ReturnType<typeof vi.fn> }
    }
    supabase.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'new-user-id' }, session: null },
      error: null,
    })

    await gotoSignUpForm()
    fireEvent.click(await screen.findByRole('button', { name: /^Konto erstellen$|^Create account$/ }))
    await screen.findByText(RX_PENDING.title)

    expect(lastAuthCb).not.toBeNull()
    // Simulate the user clicking the verification link → SDK fires SIGNED_IN.
    lastAuthCb!('SIGNED_IN', { user: { id: 'new-user-id' } })

    expect(await screen.findByText(RX_PENDING.recoveryCodeTitle)).not.toBeNull()
  })

  it('P-04: signIn with email_not_confirmed routes to the wait screen', async () => {
    const { getSyncSupabaseClient } = await import('../utils/privateSyncClient')
    const supabase = getSyncSupabaseClient() as unknown as {
      auth: { signInWithPassword: ReturnType<typeof vi.fn> }
    }
    const err: Error & { code?: string } = new Error('Email not confirmed')
    err.code = 'email_not_confirmed'
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: err,
    })

    render(<PrivateSyncSetupView onComplete={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: RX.setupButton }))
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(RX.supabaseTitle.source) }))
    fireEvent.click(await screen.findByRole<HTMLButtonElement>('button', { name: RX.continueButton }))
    fireEvent.click(await screen.findByRole<HTMLButtonElement>(
      'button', { name: /Ja, ich melde mich an|Yes, sign me in/ },
    ))

    fireEvent.change(await screen.findByLabelText(RX.emailLabel), { target: { value: 'foo@example.com' } })
    fireEvent.change(await screen.findByLabelText(RX.passwordLabel), { target: { value: 'hunter2hunter2' } })
    fireEvent.click(await screen.findByRole('button', { name: RX.signInButton }))

    await screen.findByText(RX_PENDING.title)
    // After verification, signIn-originated flow should land on enter-code, not recovery-code.
    expect(lastAuthCb).not.toBeNull()
    lastAuthCb!('SIGNED_IN', { user: { id: 'existing-user-id' } })
    expect(await screen.findByText(RX_PENDING.enterCodeTitle)).not.toBeNull()
  })
})
