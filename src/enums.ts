/**
 * Enumerados y constantes de dominio de CodeReview AI.
 * Utilizan el patrón `as const` de TypeScript para ofrecer tipado estricto,
 * autocompletado y compatibilidad con IndexedDB (Dexie).
 */

export const ReviewStatus = {
  IN_PREPARATION: 'En preparacion',
  IN_PROGRESS: 'En curso',
  APPROVED: 'Aprobada',
  CLOSED: 'Cerrada',
  PENDING: 'Pendiente',
} as const
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus]

export const CommentSeverity = {
  LOW: 'baja',
  MEDIUM: 'media',
  HIGH: 'alta',
} as const
export type CommentSeverity = (typeof CommentSeverity)[keyof typeof CommentSeverity]

export const CommentCategory = {
  SOLID: 'solid',
  SECURITY: 'security',
  QUALITY: 'quality',
} as const
export type CommentCategory = (typeof CommentCategory)[keyof typeof CommentCategory]

export const ProposalDecision = {
  PENDING: 'pendiente',
  DESIRABLE: 'deseable',
  IMPORTANT: 'importante',
  BLOCKING: 'bloqueante',
} as const
export type ProposalDecision = (typeof ProposalDecision)[keyof typeof ProposalDecision]

export const CommentLifecycle = {
  PUBLISHED: 'published',
  EDITED: 'edited',
  DELETED: 'deleted',
} as const
export type CommentLifecycle = (typeof CommentLifecycle)[keyof typeof CommentLifecycle]

export type CommentDecision = ProposalDecision | CommentLifecycle

export const CommentSource = {
  REMOTE: 'remote',
  SLM: 'slm',
  HUMAN: 'human',
} as const
export type CommentSource = (typeof CommentSource)[keyof typeof CommentSource]

export const ReviewAction = {
  APPROVE: 'approve',
  CLOSE: 'close',
  REOPEN: 'reopen',
  CONTINUE: 'continue',
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
