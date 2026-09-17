/**
 * Enumerados y constantes de dominio de CodeReview AI.
 * Utilizan el patrón `as const` de TypeScript para ofrecer tipado estricto,
 * autocompletado y compatibilidad con IndexedDB (Dexie).
 */

export const ReviewStatus = {
  IN_PREPARATION: 0,
  IN_PROGRESS: 1,
  APPROVED: 2,
  CLOSED: 3,
  PENDING: 4,
} as const
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus]

export const CommentSeverity = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
} as const
export type CommentSeverity = (typeof CommentSeverity)[keyof typeof CommentSeverity]

export const CommentCategory = {
  SOLID: 1,
  SECURITY: 2,
  QUALITY: 3,
} as const
export type CommentCategory = (typeof CommentCategory)[keyof typeof CommentCategory]

export const ProposalDecision = {
  PENDING: 0,
  DESIRABLE: 1,
  IMPORTANT: 2,
  BLOCKING: 3,
} as const
export type ProposalDecision = (typeof ProposalDecision)[keyof typeof ProposalDecision]

export const CommentLifecycle = {
  PUBLISHED: 10,
  EDITED: 11,
  DELETED: 12,
} as const
export type CommentLifecycle = (typeof CommentLifecycle)[keyof typeof CommentLifecycle]

export type CommentDecision = ProposalDecision | CommentLifecycle

export const CommentSource = {
  REMOTE: 1,
  SLM: 2,
  HUMAN: 3,
} as const
export type CommentSource = (typeof CommentSource)[keyof typeof CommentSource]

export const ReviewAction = {
  APPROVE: 1,
  CLOSE: 2,
  REOPEN: 3,
  CONTINUE: 4,
} as const
export type ReviewAction = (typeof ReviewAction)[keyof typeof ReviewAction]
export type HumanReviewDecision = ReviewAction

export const ReviewFilter = {
  ACTIVE: 'active',
  CLOSED: 'closed',
} as const
export type ReviewFilter = (typeof ReviewFilter)[keyof typeof ReviewFilter]

export const AppScreen = {
  REVIEWS: 'reviews',
  SETTINGS: 'settings',
} as const
export type AppScreen = (typeof AppScreen)[keyof typeof AppScreen]

export const PlatformType = {
  GITHUB: 'GitHub',
  GITLAB: 'GitLab',
} as const
export type Platform = (typeof PlatformType)[keyof typeof PlatformType]
