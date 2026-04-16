import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { FriendAnswerView } from './FriendAnswerView'
import type { InviteData } from '../types'

afterEach(cleanup)

const invite: InviteData = {
  profileName: 'Anna',
  topicId: 'friendship', // pre-select topic to skip the picker step
}

/** Drives the view from 'welcome' all the way to the done screen. */
function reachDoneScreen(container: HTMLElement) {
  // Welcome: enter name and proceed
  const nameInput = container.querySelector<HTMLInputElement>('.input-text')!
  fireEvent.change(nameInput, { target: { value: 'Klaus' } })
  const weiterBtn = container.querySelector<HTMLButtonElement>('.btn--primary')!
  fireEvent.click(weiterBtn)

  // Quiz: click through every question without answering
  // The "Weiter →" / "Fertig ✓" button advances unconditionally.
  let nextBtn: HTMLButtonElement | null
  while ((nextBtn = container.querySelector<HTMLButtonElement>('.btn--primary'))) {
    fireEvent.click(nextBtn)
    // Stop once we reach the done screen (export-done present, no btn--primary in quiz)
    if (container.querySelector('.export-done')) break
  }
}

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

  it('erwähnt dass Daten privat bleiben', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachDoneScreen(container)

    const cta = container.querySelector('.export-done__own-cta')
    expect(cta?.textContent).toContain('privat')
  })

  it('öffnet den Link in einem neuen Tab', () => {
    const { container } = render(<FriendAnswerView invite={invite} />)
    reachDoneScreen(container)

    const link = container.querySelector<HTMLAnchorElement>('.export-done__own-cta a')
    expect(link?.target).toBe('_blank')
    expect(link?.rel).toContain('noopener')
  })
})

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
