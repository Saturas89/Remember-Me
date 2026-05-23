import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from '../locales'
import { useSandraFlowStrings } from '../i18n/sandraFlow'
import { findTrigger } from '../data/loadPersonalQuestions'
import { buildPersonalPack } from '../lib/sandraFlow/packBuilder'
import type { ContactHandshake } from '../types'
import type {
  ComposedQuestion,
  SandraAnchor,
  SandraDraft,
} from '../types/sandraFlow'
import { SandraAnchorStep } from '../components/sandraFlow/SandraAnchorStep'
import { SandraTriggerStep } from '../components/sandraFlow/SandraTriggerStep'
import { SandraComposerStep } from '../components/sandraFlow/SandraComposerStep'
import { SandraQuestionListStep } from '../components/sandraFlow/SandraQuestionListStep'
import { SandraShareStep } from '../components/sandraFlow/SandraShareStep'

interface Props {
  profileName: string
  onBack: () => void
  /** Whether Supabase is configured in this build. When false the share link
   *  falls back to a pack-only URL (no ContactHandshake embedded). */
  onlineSharingConfigured: boolean
  /** Whether the user has already opted in to online sharing. */
  onlineSharingEnabled: boolean
  /** Device identity – available once online sharing has bootstrapped. */
  myDeviceId: string | null
  myPublicKey: string | null
  /** Called at the share step to trigger online-sharing bootstrap if needed. */
  onEnableOnlineSharing: () => void
  /** Skip the landing screen and start directly at the given step. */
  initialStep?: SandraStep
}

export type SandraStep =
  | 'anchor'
  | 'trigger'
  | 'composer'
  | 'list'
  | 'share'

const SESSION_KEY = 'rm-sandra-draft'

function emptyDraft(): SandraDraft {
  return {
    anchor: { relation: '', anrede: '' },
    questions: [],
  }
}

function loadDraft(): SandraDraft {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return emptyDraft()
    const parsed = JSON.parse(raw) as SandraDraft
    if (parsed && typeof parsed === 'object' && parsed.anchor) return parsed
  } catch { /* noop */ }
  return emptyDraft()
}

function saveDraft(draft: SandraDraft): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(draft))
  } catch { /* sessionStorage quota / privacy mode */ }
}

/**
 * REQ-020.11: the draft only persists when it has meaningful content (anchor
 * data or at least one question). An empty initial draft must NOT linger in
 * sessionStorage – otherwise a fresh tab on `#/ask` would always see a
 * "draft", which is both wasteful and breaks the spec's "vanishes when the
 * tab is closed" guarantee from the user's perspective.
 */
function isEmptyDraft(draft: SandraDraft): boolean {
  return (
    draft.questions.length === 0 &&
    !draft.anchor.relation &&
    !draft.anchor.anrede &&
    !draft.currentTriggerId &&
    !draft.currentSeed
  )
}

function clearDraft(): void {
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* noop */ }
}

function newQuestionId(): string {
  // Stable, URL-safe id with timestamp prefix
  return `cq-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function SandraFlowView({
  profileName,
  onBack,
  onlineSharingConfigured,
  onlineSharingEnabled,
  myDeviceId,
  myPublicKey,
  onEnableOnlineSharing,
  initialStep,
}: Props) {
  const { locale } = useTranslation()
  const t = useSandraFlowStrings()

  const [draft, setDraftState] = useState<SandraDraft>(loadDraft)
  const [step, setStep] = useState<SandraStep>(() => {
    if (initialStep) return initialStep
    return draft.questions.length > 0 ? 'list' : 'anchor'
  })

  // Persist draft to sessionStorage on every change. Survives reloads within
  // the same tab; vanishes when the tab is closed (per spec). Empty drafts
  // never get written so a fresh tab on `#/ask` keeps sessionStorage clean.
  useEffect(() => {
    if (isEmptyDraft(draft)) {
      clearDraft()
    } else {
      saveDraft(draft)
    }
  }, [draft])

  const updateAnchor = useCallback((anchor: SandraAnchor) => {
    setDraftState(prev => ({ ...prev, anchor }))
  }, [])

  const setCurrentTrigger = useCallback((triggerId: string | undefined) => {
    setDraftState(prev => ({ ...prev, currentTriggerId: triggerId, currentSeed: undefined }))
  }, [])

  const setCurrentSeed = useCallback((seed: string | undefined) => {
    setDraftState(prev => ({ ...prev, currentSeed: seed }))
  }, [])

  const addQuestion = useCallback((text: string, triggerId: string) => {
    const trigger = findTrigger(locale, triggerId)
    if (!trigger) return
    const q: ComposedQuestion = {
      id: newQuestionId(),
      triggerId,
      group: trigger.group,
      text,
      seed: draft.currentSeed?.trim() || undefined,
      createdAt: Date.now(),
    }
    setDraftState(prev => ({
      ...prev,
      questions: [...prev.questions, q],
      currentTriggerId: undefined,
      currentSeed: undefined,
    }))
    setStep('list')
  }, [draft.currentSeed, locale])

  const editQuestionText = useCallback((id: string, text: string) => {
    setDraftState(prev => ({
      ...prev,
      questions: prev.questions.map(q => (q.id === id ? { ...q, text } : q)),
    }))
  }, [])

  const deleteQuestion = useCallback((id: string) => {
    setDraftState(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id),
    }))
  }, [])

  const moveQuestion = useCallback((id: string, delta: 1 | -1) => {
    setDraftState(prev => {
      const idx = prev.questions.findIndex(q => q.id === id)
      if (idx < 0) return prev
      const newIdx = idx + delta
      if (newIdx < 0 || newIdx >= prev.questions.length) return prev
      const next = [...prev.questions]
      const [moved] = next.splice(idx, 1)
      next.splice(newIdx, 0, moved)
      return { ...prev, questions: next }
    })
  }, [])

  function handleResetAndExit() {
    clearDraft()
    setDraftState(emptyDraft())
    onBack()
  }

  // When Sandra reaches the share step and Supabase is configured, eagerly
  // trigger online-sharing bootstrap so her ContactHandshake is ready by the
  // time she hits "Send". If it isn't ready yet the share still works – it
  // falls back to a pack-only URL – but the handshake will be absent.
  useEffect(() => {
    if (step === 'share' && onlineSharingConfigured && !onlineSharingEnabled) {
      onEnableOnlineSharing()
    }
  }, [step, onlineSharingConfigured, onlineSharingEnabled, onEnableOnlineSharing])

  // Locale-aware fallback so an EN user on a fresh tab reads "Mom" on the
  // landing/trigger screens — not the German "Mama". Once the user has
  // picked an anrede in screen 2 we use that instead.
  const fallbackAnrede = locale === 'en' ? 'Mom' : 'Mama'
  const anredeForUi = draft.anchor.anrede || fallbackAnrede

  // ── Render the right step ────────────────────────────────────────
  if (step === 'anchor') {
    return (
      <SandraAnchorStep
        t={t}
        anchor={draft.anchor}
        onUpdate={updateAnchor}
        onBack={onBack}
        onNext={() => setStep('trigger')}
      />
    )
  }

  if (step === 'trigger') {
    return (
      <SandraTriggerStep
        t={t}
        locale={locale}
        anrede={anredeForUi}
        onBack={() => (draft.questions.length > 0 ? setStep('list') : setStep('anchor'))}
        onPick={triggerId => {
          setCurrentTrigger(triggerId)
          setStep('composer')
        }}
        onPickFreeform={() => {
          setCurrentTrigger('freeform')
          setStep('composer')
        }}
      />
    )
  }

  if (step === 'composer') {
    return (
      <SandraComposerStep
        t={t}
        locale={locale}
        anchor={draft.anchor}
        triggerId={draft.currentTriggerId ?? 'freeform'}
        seed={draft.currentSeed ?? ''}
        onSeedChange={setCurrentSeed}
        onChangeTrigger={() => setStep('trigger')}
        onDiscard={() => {
          setCurrentTrigger(undefined)
          setStep('trigger')
        }}
        onAdd={text => addQuestion(text, draft.currentTriggerId ?? 'freeform')}
      />
    )
  }

  if (step === 'list') {
    return (
      <SandraQuestionListStep
        t={t}
        anchor={draft.anchor}
        questions={draft.questions}
        onBack={() => setStep('anchor')}
        onAddAnother={() => setStep('trigger')}
        onEdit={editQuestionText}
        onDelete={deleteQuestion}
        onMove={moveQuestion}
        onSend={() => setStep('share')}
      />
    )
  }

  // step === 'share'
  const handshakeReady = Boolean(myDeviceId && myPublicKey)

  function buildHandshake(): ContactHandshake | null {
    if (!myDeviceId || !myPublicKey) return null
    return {
      $type: 'remember-me-contact',
      version: 1,
      deviceId: myDeviceId,
      publicKey: myPublicKey,
      displayName: profileName,
    }
  }

  // onShare is only non-null when the device identity is ready. Until then
  // SandraShareStep shows a loading/activate-sharing state instead.
  // useMemo prevents a new function reference on every render, which would
  // retrigger the URL pre-generation effect in SandraShareStep.
  const onShare = useMemo(() => {
    if (!handshakeReady) return null
    return async () => {
      const pack = buildPersonalPack(draft, profileName)
      const handshake = buildHandshake()!
      const { createInviteAndGetUrl } = await import('../utils/inviteService')
      const { storePendingInvite } = await import('../utils/inviteLogStore')
      const url = await createInviteAndGetUrl(pack, handshake)
      const code = url.split('/join/').pop() ?? ''
      if (code) await storePendingInvite(code).catch(() => {})
      return url
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handshakeReady, draft, profileName])

  return (
    <SandraShareStep
      t={t}
      anchor={draft.anchor}
      questions={draft.questions}
      preferSimpleMode={draft.preferSimpleMode ?? true}
      onTogglePreferSimpleMode={next => setDraftState({ ...draft, preferSimpleMode: next })}
      onBack={() => setStep('list')}
      onShare={onShare}
      onlineSharingEnabled={onlineSharingEnabled}
      onEnableOnlineSharing={onEnableOnlineSharing}
      onClearDraft={handleResetAndExit}
    />
  )
}
