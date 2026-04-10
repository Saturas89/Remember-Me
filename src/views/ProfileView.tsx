import { useState } from 'react'
import { CATEGORIES } from '../data/categories'
import type { Profile, Answer } from '../types'

interface Props {
  profile: Profile | null
  answers: Record<string, Answer>
  friendCount: number
  onSave: (profile: Profile) => void
  onBack: () => void
}

export function ProfileView({ profile, answers, friendCount, onSave, onBack }: Props) {
  const [name, setName] = useState(profile?.name ?? '')
  const [birthYear, setBirthYear] = useState(
    profile?.birthYear ? String(profile.birthYear) : '',
  )
  const [saved, setSaved] = useState(false)

  const totalQuestions = CATEGORIES.reduce((s, c) => s + c.questions.length, 0)
  const totalAnswered = Object.values(answers).filter(a => a.value.trim()).length
  const overallPct = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  const daysSince = profile?.createdAt
    ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000)
    : 0

  function handleSave() {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
      createdAt: profile?.createdAt ?? new Date().toISOString(),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="profile-view">
      <div className="archive-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Zurück
        </button>
        <h2 className="archive-title">👤 Mein Profil</h2>
      </div>

      {/* Stats */}
      <div className="profile-stats">
        <div className="profile-stat">
          <span className="profile-stat__value">{totalAnswered}</span>
          <span className="profile-stat__label">Antworten</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat__value">{overallPct}%</span>
          <span className="profile-stat__label">Abgeschlossen</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat__value">{friendCount}</span>
          <span className="profile-stat__label">Freunde</span>
        </div>
        {daysSince > 0 && (
          <div className="profile-stat">
            <span className="profile-stat__value">{daysSince}</span>
            <span className="profile-stat__label">Tage dabei</span>
          </div>
        )}
      </div>

      {/* Edit form */}
      <div className="profile-form">
        <label className="input-label" htmlFor="profile-name">Name</label>
        <input
          id="profile-name"
          className="input-text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Dein Name..."
          style={{ width: '100%', marginBottom: '1.25rem' }}
        />

        <label className="input-label" htmlFor="profile-year">Geburtsjahr</label>
        <input
          id="profile-year"
          className="input-year"
          type="number"
          min={1900}
          max={new Date().getFullYear()}
          value={birthYear}
          onChange={e => setBirthYear(e.target.value)}
          placeholder="z.B. 1970"
          style={{ display: 'block', marginBottom: '1.5rem' }}
        />

        <button
          className={`btn ${saved ? 'btn--success' : 'btn--primary'}`}
          onClick={handleSave}
          disabled={!name.trim()}
        >
          {saved ? '✓ Gespeichert' : 'Speichern'}
        </button>
      </div>

      {memberSince && (
        <p className="profile-since">Mitglied seit {memberSince}</p>
      )}
    </div>
  )
}
