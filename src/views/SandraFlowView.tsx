import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from '../locales'
import { useSandraFlowStrings } from '../i18n/sandraFlow'
import { findTrigger } from '../data/loadPersonalQuestions'
import { buildPersonalPack } from '../lib/sandraFlow/packBuilder'
import { encodeQuestionPack } from '../utils/sharing'
import {
  generateQuestionPackUrl,
  generateQuestionPackUrlSync,
} from '../utils/secureLink'
import type {
  ComposedQuestion,
  SandraAnchor,
  SandraDraft,
} from '../types/sandraFlow'
import { SandraLanding } from '../components/sandraFlow/SandraLanding'
import { SandraAnchorStep } from '../components/sandraFlow/SandraAnchorStep'
import { SandraTriggerStep } from '../components/sandraFlow/SandraTriggerStep'
import { SandraComposerStep } from '../components/sandraFlow/SandraComposerStep'
import { SandraQuestionListStep } from '../components/sandraFlow/SandraQuestionListStep'
import { SandraShareStep } from '../components/sandraFlow/SandraShareStep'

interface Props {
  profileName: string
  onBack: () => void
}

export type SandraStep =
  | 'landing'
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

export function SandraFlowView({ profileName, onBack }: Props) {
  const { locale } = useTranslation()
  const t = useSandraFlowStrings()

  const [draft, setDraftState] = useState<SandraDraft>(loadDraft)
  const [step, setStep] = useState<SandraStep>(() =>
    draft.questions.length > 0 ? 'list' : 'landing',
  )

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

  // ── Render the right step ────────────────────────────────────────
  if (step === 'landing') {
    return (
      <SandraLanding
        t={t}
        onBack={onBack}
        onStart={() => setStep('anchor')}
      />
    )
  }

  if (step === 'anchor') {
    return (
      <SandraAnchorStep
        t={t}
        anchor={draft.anchor}
        onUpdate={updateAnchor}
        onBack={() => setStep('landing')}
        onNext={() => setStep('trigger')}
      />
    )
  }

  if (step === 'trigger') {
    return (
      <SandraTriggerStep
        t={t}
        locale={locale}
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
        onBack={() => setStep('landing')}
        onAddAnother={() => setStep('trigger')}
        onEdit={editQuestionText}
        onDelete={deleteQuestion}
        onMove={moveQuestion}
        onSend={() => setStep('share')}
      />
    )
  }

  // step === 'share'
  return (
    <SandraShareStep
      t={t}
      anchor={draft.anchor}
      questions={draft.questions}
      onBack={() => setStep('list')}
      onShareSync={() => {
        const pack = buildPersonalPack(draft, profileName)
        // Synchronous URL for Web Share inside the click handler.
        return {
          url: generateQuestionPackUrlSync(pack),
          encoded: encodeQuestionPack(pack),
        }
      }}
      onShareUpgrade={async () => {
        const pack = buildPersonalPack(draft, profileName)
        return await generateQuestionPackUrl(pack)
      }}
      onClearDraft={handleResetAndExit}
    />
  )
}
