const reviewEvents = new EventTarget()

export function emitReviewProgress(reviewId: number) {
  reviewEvents.dispatchEvent(new CustomEvent<number>('progress', { detail: reviewId }))
}

export function onReviewProgress(listener: (reviewId: number) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<number>).detail)
  reviewEvents.addEventListener('progress', handler)
  return () => reviewEvents.removeEventListener('progress', handler)
}
