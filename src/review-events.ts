const reviewEvents = new EventTarget()

export interface ReviewThinkingState {
  reviewId: number
  filePath?: string
  fileIndex?: number
  totalFiles?: number
  thought?: string
  phase?: 'thinking' | 'suggesting' | 'completed'
}

const activeThinkingStates = new Map<number, ReviewThinkingState>()

export function getReviewThinking(reviewId: number): ReviewThinkingState | undefined {
  return activeThinkingStates.get(reviewId)
}

export function emitReviewProgress(reviewId: number) {
  reviewEvents.dispatchEvent(new CustomEvent<number>('progress', { detail: reviewId }))
}

export function onReviewProgress(listener: (reviewId: number) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<number>).detail)
  reviewEvents.addEventListener('progress', handler)
  return () => reviewEvents.removeEventListener('progress', handler)
}

export function emitReviewThinking(state: ReviewThinkingState) {
  if (state.phase === 'completed') {
    activeThinkingStates.delete(state.reviewId)
  } else {
    activeThinkingStates.set(state.reviewId, state)
  }
  reviewEvents.dispatchEvent(new CustomEvent<ReviewThinkingState>('thinking', { detail: state }))
}

export function onReviewThinking(listener: (state: ReviewThinkingState) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<ReviewThinkingState>).detail)
  reviewEvents.addEventListener('thinking', handler)
  return () => reviewEvents.removeEventListener('thinking', handler)
}
