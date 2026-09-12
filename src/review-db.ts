import Dexie, { type Table } from 'dexie'
import { parseReviewUrl } from './platform-url'
import type { RemoteChange, RemoteComment, RemoteFile } from './platform-api'
import { trace } from './diagnostics'

export type ReviewStatus = 'En curso' | 'En preparacion' | 'Cerrada' | 'Aprobada'

export interface Review {
  id?: number
  title: string
  repository: string
  provider: 'GitHub' | 'GitLab'
  status: ReviewStatus
  progress: number
  comments: number
  updated: string
  remoteChange?: RemoteChange
  remoteFiles?: RemoteFile[]
  remoteComments?: RemoteComment[]
}

export interface StoredReviewFile extends RemoteFile {
  id?: number
  reviewId: number
}

export type CommentDecision = 'pendiente' | 'deseable' | 'importante' | 'bloqueante' | 'published' | 'pending' | 'accepted' | 'edited' | 'deleted'
export type CommentCategory = 'solid' | 'security' | 'quality'

export interface StoredReviewComment extends Omit<RemoteComment, 'id'> {
  id?: number
  reviewId: number
  remoteId: string
  source?: 'remote' | 'slm' | 'human'
  decision?: CommentDecision
  category?: CommentCategory
  recommendation?: string
  severity?: 'baja' | 'media' | 'alta'
}

class ReviewDatabase extends Dexie {
  reviews!: Table<Review, number>
  reviewFiles!: Table<StoredReviewFile, number>
  reviewComments!: Table<StoredReviewComment, number>

  constructor() {
    super('codereview-ai')
    this.version(1).stores({ reviews: '++id, status, updated' })
    this.version(2).stores({
      reviews: '++id, status, updated',
      reviewFiles: '++id, reviewId, [reviewId+path]',
      reviewComments: '++id, reviewId, remoteId, [reviewId+path+line]',
    })
  }
}

const database = new ReviewDatabase()

export async function listReviews() {
  const storedReviews = await database.reviews.toArray()
  await database.transaction('rw', database.reviewFiles, database.reviewComments, async () => {
    for (const review of storedReviews) {
      if (!review.id) continue
      if (review.remoteFiles?.length) {
        const storedFileCount = await database.reviewFiles.where('reviewId').equals(review.id).count()
        if (storedFileCount !== review.remoteFiles.length) {
          await database.reviewFiles.where('reviewId').equals(review.id).delete()
          await database.reviewFiles.bulkAdd(review.remoteFiles.map((file) => ({ ...file, reviewId: review.id! })))
        }
      }
      if (review.remoteComments?.length) {
        const storedCommentCount = await database.reviewComments.where('reviewId').equals(review.id).count()
        if (storedCommentCount !== review.remoteComments.length) {
          await database.reviewComments.where('reviewId').equals(review.id).delete()
          await database.reviewComments.bulkAdd(review.remoteComments.map(({ id: remoteId, ...comment }) => ({ ...comment, reviewId: review.id!, remoteId })))
        }
      }
    }
  })
  return storedReviews
}

export async function getReviewKpis() {
  const [activeReviews, allComments] = await Promise.all([
    database.reviews.where('status').equals('En curso').count(),
    database.reviewComments.toArray(),
  ])
  const pendingSlmComments = allComments.filter((comment) => comment.source === 'slm' && comment.decision !== 'published').length
  const publishedComments = allComments.filter((comment) => comment.decision === 'published').length
  return { activeReviews, pendingSlmComments, publishedComments }
}

export async function createReview(url: string, snapshot?: { change: RemoteChange; files: RemoteFile[]; comments: RemoteComment[] }) {
  const location = parseReviewUrl(url)
  trace('storage.review.create.start', { provider: location.provider, repositoryPath: location.repositoryPath, changeNumber: location.changeNumber, fileCount: snapshot?.files.length ?? 0, commentCount: snapshot?.comments.length ?? 0 })
  const title = `${location.provider} #${location.changeNumber}: ${location.repository}`
  return database.transaction('rw', database.reviews, database.reviewFiles, database.reviewComments, async () => {
    const reviewId = await database.reviews.add({
      title,
      repository: location.repositoryPath,
      provider: location.provider,
      status: 'En preparacion',
      progress: 8,
      comments: snapshot?.comments.length ?? 0,
      updated: 'Ahora',
      remoteChange: snapshot?.change,
      remoteFiles: snapshot?.files,
      remoteComments: snapshot?.comments,
    })

    if (snapshot) {
      await database.reviewFiles.bulkAdd(snapshot.files.map((file) => ({ ...file, reviewId })))
      await database.reviewComments.bulkAdd(snapshot.comments.map(({ id: remoteId, ...comment }) => ({ ...comment, reviewId, remoteId })))
    }

    trace('storage.review.create.complete', { reviewId, fileCount: snapshot?.files.length ?? 0, commentCount: snapshot?.comments.length ?? 0 })
    return reviewId
  })
}

export async function listReviewFiles(reviewId: number) {
  const files = await database.reviewFiles.where('reviewId').equals(reviewId).toArray()
  trace('storage.files.loaded', { reviewId, count: files.length })
  return files
}

export async function listReviewComments(reviewId: number) {
  return database.reviewComments.where('reviewId').equals(reviewId).toArray()
}

export async function saveSlmSuggestions(reviewId: number, suggestions: Array<{ id: string; filePath: string; line: number; severity: 'baja' | 'media' | 'alta'; category: 'solid' | 'security' | 'quality'; message: string; recommendation: string }>) {
  await database.transaction('rw', database.reviews, database.reviewComments, async () => {
    const existingSlmComments = await database.reviewComments.where('reviewId').equals(reviewId).filter((comment) => comment.source === 'slm').toArray()
    const existingIds = new Set(existingSlmComments.map((comment) => comment.remoteId))
    const newSuggestions = suggestions.filter((suggestion) => !existingIds.has(`slm:${suggestion.id}`))
    await database.reviewComments.bulkAdd(newSuggestions.map((suggestion) => ({
      reviewId,
      remoteId: `slm:${suggestion.id}`,
      author: 'SLM local',
      body: suggestion.message,
      path: suggestion.filePath,
      line: suggestion.line,
      createdAt: new Date().toISOString(),
      source: 'slm' as const,
      decision: 'pendiente' as const,
      category: suggestion.category,
      recommendation: suggestion.recommendation,
    })))
    await database.reviews.update(reviewId, { comments: existingSlmComments.length + newSuggestions.length, updated: 'Ahora' })
    suggestions = newSuggestions
  })
  trace('storage.slm-suggestions.complete', { reviewId, count: suggestions.length })
}

export async function updateReviewProgress(id: number, progress: number) {
  await database.reviews.update(id, { progress, updated: 'Ahora' })
}

export async function clearSlmSuggestions(reviewId: number) {
  await database.transaction('rw', database.reviews, database.reviewComments, async () => {
    await database.reviewComments.where('reviewId').equals(reviewId).filter((comment) => comment.source === 'slm').delete()
    const remainingComments = await database.reviewComments.where('reviewId').equals(reviewId).count()
    await database.reviews.update(reviewId, { comments: remainingComments, updated: 'Ahora' })
  })
}

export async function updateReviewStatus(id: number, status: ReviewStatus) {
  await database.reviews.update(id, { status, progress: status === 'Cerrada' || status === 'Aprobada' ? 100 : status === 'En curso' ? 68 : 8, updated: 'Ahora' })
}

export async function updateReviewComment(id: number, changes: {
  body: string
  severity?: 'baja' | 'media' | 'alta'
  category?: CommentCategory
  decision?: CommentDecision
}) {
  await database.reviewComments.update(id, {
    body: changes.body,
    ...(changes.severity ? { severity: changes.severity } : {}),
    ...(changes.category ? { category: changes.category } : {}),
    ...(changes.decision ? { decision: changes.decision } : {}),
  })
}

export async function markReviewCommentPublished(id: number) {
  await database.reviewComments.update(id, { decision: 'published' })
}

export async function deleteReviewComment(id: number) {
  const comment = await database.reviewComments.get(id)
  if (!comment) return
  await database.transaction('rw', database.reviews, database.reviewComments, async () => {
    await database.reviewComments.delete(id)
    const remainingComments = await database.reviewComments.where('reviewId').equals(comment.reviewId).count()
    await database.reviews.update(comment.reviewId, { comments: remainingComments, updated: 'Ahora' })
  })
}

export async function addManualReviewComment(reviewId: number, input: {
  path?: string
  line?: number
  body: string
  severity?: 'baja' | 'media' | 'alta'
  category?: CommentCategory
  decision?: CommentDecision
}) {
  await database.transaction('rw', database.reviews, database.reviewComments, async () => {
    await database.reviewComments.add({
      reviewId,
      remoteId: `manual:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      author: 'Revisor local',
      body: input.body,
      path: input.path,
      line: input.line,
      createdAt: new Date().toISOString(),
      source: 'human',
      decision: input.decision ?? 'pendiente',
      category: input.category ?? 'solid',
      severity: input.severity ?? 'media',
    })
    const totalComments = await database.reviewComments.where('reviewId').equals(reviewId).count()
    await database.reviews.update(reviewId, { comments: totalComments, updated: 'Ahora' })
  })
}
