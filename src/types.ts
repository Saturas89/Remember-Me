export type QuestionType = 'text' | 'choice' | 'scale' | 'year'

export interface Question {
  id: string
  categoryId: string
  type: QuestionType
  text: string
  helpText?: string
  options?: string[]
  scaleMin?: string
  scaleMax?: string
}

export interface Category {
  id: string
  title: string
  description: string
  emoji: string
  questions: Question[]
}

export interface Answer {
  id: string
  questionId: string
  categoryId: string
  value: string
  createdAt: string
  updatedAt: string
}

export interface Profile {
  name: string
  birthYear?: number
  createdAt: string
}

export interface AppState {
  profile: Profile | null
  answers: Record<string, Answer>
}
