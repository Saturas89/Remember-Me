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

vi.mock('../utils/privateSyncClient', () => ({
  getSyncSupabaseClient: () => ({
    auth: {
      signInWithPassword: vi.fn(async () => ({
        data: { user: { id: 'test-user-id' } },
        error: null,
      })),
      signUp: vi.fn(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ single: vi.fn(async () => ({ data: null })) }),
      }),
    }),
  }),
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
