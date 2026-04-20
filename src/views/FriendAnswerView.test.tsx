import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { FriendAnswerView } from './FriendAnswerView'
import type { InviteData } from '../types'

afterEach(cleanup)

const invite: InviteData = {
  profileName: 'Anna',
  topicId: 'friendship', // pre-select topic to skip the picker step
}

/** Enters a name and advances to the quiz step. */
function reachQuizScreen(container: HTMLElement, name = 'Klaus') {
  const nameInput = container.querySelector<HTMLInputElement>('.input-text')!
  fireEvent.change(nameInput, { target: { value: name } })
  fireEvent.click(container.querySelector<HTMLButtonElement>('.btn--primary')!)
}

/** Drives the view from 'welcome' all the way to the done screen. */
function reachDoneScreen(container: HTMLElement) {
  reachQuizScreen(container)
  let nextBtn: HTMLButtonElement | null
  while ((nextBtn = container.querySelector<HTMLButtonElement>('.btn--primary'))) {
    fireEvent.click(nextBtn)
    if (container.querySelector('.export-done')) break
  }
}

// ── Welcome-Screen ────────────────────────────────────────────────────────────

describe('FriendAnswerView – Welcome-Screen', () => {
  it('zeigt den Namen des Einladers', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    expect(container.textContent).toContain('Anna')
  })

  it('der Weiter-Button ist deaktiviert wenn kein Name eingegeben', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    const btn = container.querySelector<HTMLButtonElement>('.btn--primary')
    expect(btn?.disabled).toBe(true)
  })

  it('der Weiter-Button wird aktiv wenn ein Name eingegeben wird', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    const input = container.querySelector<HTMLInputElement>('.input-text')!
    fireEvent.change(input, { target: { value: 'Klaus' } })
    const btn = container.querySelector<HTMLButtonElement>('.btn--primary')
    expect(btn?.disabled).toBe(false)
  })
})

// ── Quiz-Screen ───────────────────────────────────────────────────────────────

describe('FriendAnswerView – Quiz-Screen', () => {
  it('zeigt die erste Frage nach dem Welcome-Screen', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachQuizScreen(container)
    expect(container.querySelector('.question-card')).toBeTruthy()
  })

  it('zeigt das Texteingabefeld für die erste Frage', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachQuizScreen(container)
    expect(container.querySelector('textarea.input-textarea')).toBeTruthy()
  })

  it('zeigt die Media-Toolbar mit Audio-Aufnahme-Button', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachQuizScreen(container)
    // MediaCapture renders the unified media toolbar
    expect(container.querySelector('.media-toolbar')).toBeTruthy()
    const audioBtn = container.querySelector<HTMLButtonElement>('[aria-label*="Sprachaufnahme"]')
    expect(audioBtn).toBeTruthy()
  })

  it('zeigt Foto- und Video-Buttons in der Media-Toolbar', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachQuizScreen(container)
    const photoBtn = container.querySelector<HTMLButtonElement>('[aria-label*="Foto"]')
    const videoBtn = container.querySelector<HTMLButtonElement>('[aria-label*="Video"]')
    expect(photoBtn).toBeTruthy()
    expect(videoBtn).toBeTruthy()
  })

  it('eingegebener Text bleibt erhalten beim Navigieren zurück und weiter', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachQuizScreen(container)

    const textarea = container.querySelector<HTMLTextAreaElement>('textarea.input-textarea')!
    fireEvent.change(textarea, { target: { value: 'Ich kenne Anna seit Jahren' } })

    // Go to next question
    fireEvent.click(container.querySelector<HTMLButtonElement>('.btn--primary')!)
    // Go back
    fireEvent.click(container.querySelector<HTMLButtonElement>('.btn--ghost')!)

    const restored = container.querySelector<HTMLTextAreaElement>('textarea.input-textarea')!
    expect(restored.value).toBe('Ich kenne Anna seit Jahren')
  })

  it('zeigt einen Fortschrittsbalken', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachQuizScreen(container)
    expect(container.querySelector('.progress-bar-wrap')).toBeTruthy()
  })
})

// ── Fertig-Screen ─────────────────────────────────────────────────────────────

describe('FriendAnswerView – Fertig-Screen CTA', () => {
  it('zeigt den Link auf rememberme.dad', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachDoneScreen(container)

    const link = container.querySelector<HTMLAnchorElement>('.export-done__own-cta a')
    expect(link).toBeTruthy()
    expect(link?.href).toBe('https://rememberme.dad/')
  })

  it('zeigt das Promo-Bild', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachDoneScreen(container)

    const img = container.querySelector<HTMLImageElement>('.export-done__own-cta-img')
    expect(img).toBeTruthy()
    expect(img?.src).toContain('friend-invite-promo.jpeg')
  })

  it('das Promo-Bild ist mit rememberme.dad verlinkt', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachDoneScreen(container)

    const img = container.querySelector('.export-done__own-cta-img')
    const parentLink = img?.closest('a') as HTMLAnchorElement | null
    expect(parentLink).toBeTruthy()
    expect(parentLink?.href).toBe('https://rememberme.dad/')
    expect(parentLink?.target).toBe('_blank')
  })

  it('zeigt den CTA-Text mit Einladung zur eigenen App', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachDoneScreen(container)

    const cta = container.querySelector('.export-done__own-cta')
    expect(cta?.textContent).toContain('Erinnerungen')
  })

  it('öffnet den Link in einem neuen Tab', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachDoneScreen(container)

    const link = container.querySelector<HTMLAnchorElement>('.export-done__own-cta a')
    expect(link?.target).toBe('_blank')
    expect(link?.rel).toContain('noopener')
  })

  it('zeigt den Teilen-Button nach dem Fertigstellen', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachDoneScreen(container)
    expect(container.querySelector('.share-cta-btn')).toBeTruthy()
  })
})
