import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { FeedbackModal } from './FeedbackModal'
import { UI_DE as de } from '../locales/de/ui'

const submitMock = vi.fn()
const markMock = vi.fn()

vi.mock('../utils/feedbackSubmit', () => ({
  submitFeedback: (payload: unknown) => submitMock(payload),
  markFeedbackSubmitted: () => markMock(),
}))

describe('FeedbackModal', () => {
  beforeEach(() => {
    submitMock.mockReset()
    markMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders title, subtitle and five smiley buttons', () => {
    render(<FeedbackModal onClose={vi.fn()} />)
    expect(screen.getByText(de.feedback.modalTitle)).not.toBeNull()
    expect(screen.getByText(de.feedback.subtitle)).not.toBeNull()
    const smileys = screen.getAllByRole('radio')
    expect(smileys).toHaveLength(5)
  })

  it('keeps submit disabled until a smiley is picked', () => {
    render(<FeedbackModal onClose={vi.fn()} />)
    const submit = screen.getByRole('button', { name: de.feedback.submit })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
  })

  it('reveals the optional textarea only after a smiley is picked', () => {
    render(<FeedbackModal onClose={vi.fn()} />)
    expect(screen.queryByLabelText(de.feedback.commentLabel)).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: de.feedback.r4 }))
    expect(screen.getByLabelText(de.feedback.commentLabel)).not.toBeNull()
  })

  it('marks the picked smiley as the active radio', () => {
    render(<FeedbackModal onClose={vi.fn()} />)
    const happy = screen.getByRole('radio', { name: de.feedback.r5 })
    fireEvent.click(happy)
    expect(happy.getAttribute('aria-checked')).toBe('true')
    expect(happy.classList.contains('feedback-smiley--active')).toBe(true)
  })

  it('submits rating and comment, marks ack, then auto-closes', async () => {
    submitMock.mockResolvedValue({ ok: true })
    const onClose = vi.fn()
    render(<FeedbackModal onClose={onClose} />)

    fireEvent.click(screen.getByRole('radio', { name: de.feedback.r4 }))
    fireEvent.change(screen.getByLabelText(de.feedback.commentLabel), {
      target: { value: 'Klasse App' },
    })
    fireEvent.click(screen.getByRole('button', { name: de.feedback.submit }))

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    expect(submitMock).toHaveBeenCalledWith({ rating: 4, comment: 'Klasse App' })
    expect(markMock).toHaveBeenCalledTimes(1)

    await screen.findByText(de.feedback.thanks)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 2500 })
  })

  it('caps comments at 500 characters', () => {
    render(<FeedbackModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: de.feedback.r3 }))
    const textarea = screen.getByLabelText(de.feedback.commentLabel) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'x'.repeat(600) } })
    expect(textarea.value.length).toBe(500)
  })

  it('shows a connection hint when Supabase is not configured', async () => {
    submitMock.mockResolvedValue({ ok: false, reason: 'not-configured' })
    render(<FeedbackModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: de.feedback.r2 }))
    fireEvent.click(screen.getByRole('button', { name: de.feedback.submit }))

    await screen.findByText(de.feedback.errorNoConnection)
    expect(markMock).not.toHaveBeenCalled()
  })

  it('shows a network hint when submit rejects', async () => {
    submitMock.mockResolvedValue({ ok: false, reason: 'network', error: 'offline' })
    render(<FeedbackModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: de.feedback.r1 }))
    fireEvent.click(screen.getByRole('button', { name: de.feedback.submit }))

    await screen.findByText(de.feedback.errorNetwork)
  })

  it('closes immediately when the close button is pressed', () => {
    const onClose = vi.fn()
    render(<FeedbackModal onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: de.feedback.close }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sets dialog accessibility attributes', () => {
    render(<FeedbackModal onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('feedback-modal-title')
  })
})
