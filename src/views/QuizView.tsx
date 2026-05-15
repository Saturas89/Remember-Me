import { useEffect, useRef, useState } from 'react'
import { QuestionCard } from '../components/QuestionCard'
import { ProgressBar } from '../components/ProgressBar'
import { useTranslation } from '../locales'
import { useImageStore } from '../hooks/useImageStore'
import { addAudio, removeAudio } from '../hooks/useAudioStore'
import { addVideo, removeVideo } from '../hooks/useVideoStore'
import {
  trackQuizStarted, trackQuizCompleted, trackQuizAbandoned, trackQuizMediaAdded,
} from '../lib/analytics'
import type { Category } from '../types'

interface Props {
  category: Category
  getAnswer: (questionId: string) => string
  getAnswerImageIds: (questionId: string) => string[]
  getAnswerVideoIds: (questionId: string) => string[]
  getAnswerAudioId: (questionId: string) => string | undefined
  onSave: (questionId: string, categoryId: string, value: string) => void
  onSetImages: (questionId: string, categoryId: string, imageIds: string[]) => void
  onSetVideos: (questionId: string, categoryId: string, videoIds: string[]) => void
  onSetAudio: (questionId: string, categoryId: string, audioId: string | undefined, audioTranscribedAt: string | undefined, audioTranscript?: string) => void
  onBack: () => void
}

export function QuizView({
  category, getAnswer, getAnswerImageIds, getAnswerVideoIds, getAnswerAudioId,
  onSave, onSetImages, onSetVideos, onSetAudio, onBack,
}: Props) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const { cache, loadImages, addImage, removeImage } = useImageStore()
  const question = category.questions[index]
  const progress  = Math.round((index / category.questions.length) * 100)
  const imageIds  = getAnswerImageIds(question.id)
  const videoIds  = getAnswerVideoIds(question.id)
  const audioId   = getAnswerAudioId(question.id)

  // Refs keep beforeunload handler up-to-date without re-registering on every render.
  const indexRef = useRef(index)
  indexRef.current = index
  const exitTrackedRef = useRef(false)

  useEffect(() => {
    trackQuizStarted(category.id, category.questions.length)

    function handleBeforeUnload() {
      if (!exitTrackedRef.current) {
        exitTrackedRef.current = true
        trackQuizAbandoned(category.id, indexRef.current, category.questions.length)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave(value: string) {
    onSave(question.id, category.id, value)
  }

  async function handleAddImage(file: File) {
    const id = await addImage(file)
    onSetImages(question.id, category.id, [...imageIds, id])
    trackQuizMediaAdded(category.id, 'image')
  }

  async function handleRemoveImage(id: string) {
    await removeImage(id)
    onSetImages(question.id, category.id, imageIds.filter(i => i !== id))
  }

  async function handleAddVideo(file: File) {
    const id = await addVideo(file)
    onSetVideos(question.id, category.id, [...videoIds, id])
    trackQuizMediaAdded(category.id, 'video')
  }

  async function handleRemoveVideo(id: string) {
    await removeVideo(id)
    onSetVideos(question.id, category.id, videoIds.filter(v => v !== id))
  }

  async function handleSaveAudio(transcript: string, blob: Blob | null) {
    if (audioId) await removeAudio(audioId)
    const id = blob ? await addAudio(blob) : undefined
    onSetAudio(question.id, category.id, id, new Date().toISOString(), transcript || undefined)
    if (blob) trackQuizMediaAdded(category.id, 'audio')
  }

  async function handleRemoveAudio() {
    if (audioId) await removeAudio(audioId)
    onSetAudio(question.id, category.id, undefined, undefined)
  }

  function handleBack() {
    if (!exitTrackedRef.current) {
      exitTrackedRef.current = true
      trackQuizAbandoned(category.id, index, category.questions.length)
    }
    onBack()
  }

  function handleNext() {
    if (index + 1 < category.questions.length) {
      setIndex(i => i + 1)
    } else {
      exitTrackedRef.current = true
      trackQuizCompleted(category.id, category.questions.length)
      onBack()
    }
  }

  return (
    <div className="quiz-view">
      <img src={`/categories/${category.id}-banner.svg`} className="quiz-banner" alt="" />
      <div className="quiz-topbar">
        <button className="btn btn--ghost btn--sm" onClick={handleBack}>
          {t.quiz.backButton}
        </button>
        <span className="quiz-category-title">
          {category.emoji} {category.title}
        </span>
      </div>

      <ProgressBar value={progress} />

      <QuestionCard
        question={question}
        initialValue={getAnswer(question.id)}
        imageIds={imageIds}
        imageCache={cache}
        videoIds={videoIds}
        audioId={audioId}
        index={index}
        total={category.questions.length}
        onSave={handleSave}
        onLoadImages={loadImages}
        onAddImage={handleAddImage}
        onRemoveImage={handleRemoveImage}
        onAddVideo={handleAddVideo}
        onRemoveVideo={handleRemoveVideo}
        onSaveAudio={handleSaveAudio}
        onRemoveAudio={handleRemoveAudio}
        onNext={handleNext}
        onPrev={() => setIndex(i => Math.max(0, i - 1))}
        canGoBack={index > 0}
      />
    </div>
  )
}
