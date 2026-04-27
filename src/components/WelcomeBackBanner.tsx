import { useState, useEffect } from 'react'
import { useTranslation } from '../locales'
import { findNextUnansweredQuestion } from '../utils/notificationContent'
import type { Answer } from '../types'

interface Props {
  answers: Record<string, Answer>
  profileName: string
  onNavigateToQuestion: (questionId: string) => void
  onDismiss: () => void
}

export function WelcomeBackBanner({ answers, profileName, onNavigateToQuestion, onDismiss }: Props) {
  const { t, locale } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has been away for 3+ days
    const lastActivity = getLastActivityDate(answers)
    if (!lastActivity) return

    const now = Date.now()
    const daysSince = Math.floor((now - lastActivity) / (24 * 60 * 60 * 1000))
    
    if (daysSince >= 3) {
      // Check if banner was already shown today
      const lastShown = localStorage.getItem('rm-welcome-back-shown')
      const today = new Date().toDateString()
      
      if (lastShown !== today) {
        setIsVisible(true)
        localStorage.setItem('rm-welcome-back-shown', today)
      }
    }
  }, [answers])

  const handleContinue = () => {
    const nextQuestion = findNextUnansweredQuestion(answers, locale)
    if (nextQuestion) {
      onNavigateToQuestion(nextQuestion.id)
    } else {
      // Navigate to home if no unanswered questions
      onNavigateToQuestion('')
    }
    handleDismiss()
  }

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss()
  }

  if (!isVisible) return null

  return (
    <div 
      className="update-banner welcome-back-banner" 
      data-testid="welcome-back-banner"
      role="alert"
      aria-live="polite"
    >
      <div className="welcome-back-banner__content">
        <div className="welcome-back-banner__icon">
          👋
        </div>
        <div className="welcome-back-banner__text">
          <h3 className="welcome-back-banner__title">
            {t.reminder?.welcomeBack?.title || `Willkommen zurück, ${profileName}!`}
          </h3>
          <p className="welcome-back-banner__message">
            {t.reminder?.welcomeBack?.message || 'Schön, dass du wieder da bist! Zeit für neue Erinnerungen.'}
          </p>
        </div>
      </div>
      <div className="welcome-back-banner__actions">
        <button 
          className="btn btn--primary btn--sm welcome-back-banner__continue"
          onClick={handleContinue}
          data-testid="welcome-back-continue"
        >
          {t.reminder?.welcomeBack?.continue || 'Weitermachen'}
        </button>
        <button 
          className="btn btn--ghost btn--sm welcome-back-banner__dismiss"
          onClick={handleDismiss}
          aria-label={t.global?.cancel || 'Schließen'}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function getLastActivityDate(answers: Record<string, Answer>): number | null {
  const answerDates = Object.values(answers)
    .map(a => new Date(a.updatedAt).getTime())
    .filter(date => !isNaN(date))
  
  return answerDates.length > 0 ? Math.max(...answerDates) : null
}