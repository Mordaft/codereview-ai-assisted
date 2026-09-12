import { reviewWorkflow, type ReviewGraphState } from './review-graph'

export type HumanReviewDecision = 'continue' | 'close' | 'approve'

function threadConfig(reviewId: number) {
  return { configurable: { thread_id: `review-${reviewId}` } }
}

export async function startReviewWorkflow(reviewId: number) {
  return reviewWorkflow.invoke(
    {
      reviewId,
      status: 'Pendiente',
    },
    threadConfig(reviewId),
  )
}

export async function resumeReviewWorkflow(reviewId: number, decision: HumanReviewDecision) {
  return reviewWorkflow.invoke(
    {
      reviewId,
      status: 'En curso',
      humanDecision: decision,
    },
    threadConfig(reviewId),
  )
}

export function isWorkflowState(value: unknown): value is ReviewGraphState {
  return typeof value === 'object' && value !== null && 'reviewId' in value && 'status' in value
}
