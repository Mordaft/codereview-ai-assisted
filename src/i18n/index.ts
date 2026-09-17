import type { SupportedLanguage, TranslationDictionary } from './types'
import { es } from './locales/es'
import { en } from './locales/en'
import {
  CommentSource,
  ProposalDecision,
  ReviewStatus,
  type CommentCategory as CommentCategoryType,
  type CommentSeverity as CommentSeverityType,
  type CommentSource as CommentSourceType,
  type ProposalDecision as ProposalDecisionType,
  type ReviewStatus as ReviewStatusType,
} from '../enums'

export type { SupportedLanguage, TranslationDictionary } from './types'

const STORAGE_KEY = 'codereview-lang'

const dictionaries: Record<SupportedLanguage, TranslationDictionary> = {
  es,
  en,
}

function detectInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return 'es'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'es' || saved === 'en') return saved
  if (typeof navigator !== 'undefined' && navigator.language && navigator.language.toLowerCase().startsWith('en')) {
    return 'en'
  }
  return 'es'
}

let currentLanguage: SupportedLanguage = detectInitialLanguage()

if (typeof document !== 'undefined') {
  document.documentElement.lang = currentLanguage
}

type LanguageListener = (lang: SupportedLanguage) => void
const listeners: LanguageListener[] = []

export function getLanguage(): SupportedLanguage {
  return currentLanguage
}

export function setLanguage(lang: SupportedLanguage) {
  if (lang !== 'es' && lang !== 'en') return
  currentLanguage = lang
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lang)
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang
  }
  for (const listener of [...listeners]) {
    try {
      listener(lang)
    } catch (error) {
      console.error('Error in language listener:', error)
    }
  }
}

export function toggleLanguage(): SupportedLanguage {
  const nextLang: SupportedLanguage = currentLanguage === 'es' ? 'en' : 'es'
  setLanguage(nextLang)
  return nextLang
}

export function onLanguageChange(listener: LanguageListener): () => void {
  listeners.push(listener)
  return () => {
    const index = listeners.indexOf(listener)
    if (index >= 0) listeners.splice(index, 1)
  }
}

function resolvePath(obj: unknown, path: string): unknown {
  const segments = path.split('.')
  let current: unknown = obj
  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in current) {
      current = (current as Record<string, unknown>)[segment]
    } else {
      return undefined
    }
  }
  return current
}

export function t(path: string, params?: Record<string, string | number>): string {
  const langDict = dictionaries[currentLanguage]
  const fallbackDict = dictionaries.es

  let raw = resolvePath(langDict, path)
  if (typeof raw !== 'string') {
    raw = resolvePath(fallbackDict, path)
  }
  if (typeof raw !== 'string') {
    return path
  }

  if (!params) return raw

  return raw.replace(/\{(\w+)\}/g, (match, key) => {
    return key in params ? String(params[key]) : match
  })
}

export function tStatus(status: ReviewStatusType | string): string {
  const dict = dictionaries[currentLanguage].domain.statuses
  switch (status) {
    case ReviewStatus.IN_PROGRESS:
      return dict.inProgress
    case ReviewStatus.IN_PREPARATION:
      return dict.inPreparation
    case ReviewStatus.CLOSED:
      return dict.closed
    case ReviewStatus.APPROVED:
      return dict.approved
    case ReviewStatus.PENDING:
      return dict.inPreparation
    default:
      return status
  }
}

export function tSeverity(severity?: CommentSeverityType | string): string {
  if (!severity) return dictionaries[currentLanguage].domain.severities.media
  const key = severity.toLowerCase() as CommentSeverityType
  const dict = dictionaries[currentLanguage].domain.severities
  return dict[key] ?? (severity.charAt(0).toUpperCase() + severity.slice(1))
}

export function tCategory(category?: CommentCategoryType | string): string {
  if (!category) return dictionaries[currentLanguage].domain.categories.solid
  const key = category.toLowerCase() as CommentCategoryType
  const dict = dictionaries[currentLanguage].domain.categories
  return dict[key] ?? (category.charAt(0).toUpperCase() + category.slice(1))
}

export function tDecision(decision?: ProposalDecisionType | string): string {
  const dict = dictionaries[currentLanguage].domain.decisions
  switch (decision?.toLowerCase()) {
    case ProposalDecision.DESIRABLE:
      return dict.deseable
    case ProposalDecision.IMPORTANT:
      return dict.importante
    case ProposalDecision.BLOCKING:
      return dict.bloqueante
    case ProposalDecision.PENDING:
    case 'pending':
    case 'edited':
    default:
      return dict.pendiente
  }
}

export function tAuthor(author?: string, source?: CommentSourceType | string): string {
  const dict = dictionaries[currentLanguage].domain.authors
  if (author) {
    if (author === 'SLM local') return dict.localSlm
    if (author === 'Revisor local') return dict.localReviewer
    if (author === 'Revisor remoto') return dict.remoteReviewer
    if (author === 'Revisor') return dict.reviewer
    return author
  }
  if (source === CommentSource.SLM) return dict.localSlm
  if (source === CommentSource.HUMAN) return dict.localReviewer
  if (source === CommentSource.REMOTE) return dict.remoteReviewer
  return dict.reviewer
}

export function formatRelativeTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) {
    return currentLanguage === 'es' ? 'Ahora' : 'Just now'
  }
  if (typeof dateInput === 'string' && (dateInput.toLowerCase() === 'ahora' || dateInput.toLowerCase() === 'now')) {
    return currentLanguage === 'es' ? 'Ahora' : 'Just now'
  }

  const timestamp = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput).getTime()
    : dateInput.getTime()

  if (Number.isNaN(timestamp)) {
    return currentLanguage === 'es' ? 'Ahora' : 'Just now'
  }

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000)
  const absSeconds = Math.abs(diffSeconds)

  if (absSeconds < 45) {
    return currentLanguage === 'es' ? 'Ahora' : 'Just now'
  }

  const rtf = new Intl.RelativeTimeFormat(currentLanguage, { numeric: 'auto' })

  let formatted: string
  if (absSeconds < 3600) {
    const minutes = Math.round(diffSeconds / 60)
    formatted = rtf.format(minutes, 'minute')
  } else if (absSeconds < 86400) {
    const hours = Math.round(diffSeconds / 3600)
    formatted = rtf.format(hours, 'hour')
  } else if (absSeconds < 2592000) {
    const days = Math.round(diffSeconds / 86400)
    formatted = rtf.format(days, 'day')
  } else if (absSeconds < 31536000) {
    const months = Math.round(diffSeconds / 2592000)
    formatted = rtf.format(months, 'month')
  } else {
    const years = Math.round(diffSeconds / 31536000)
    formatted = rtf.format(years, 'year')
  }

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

