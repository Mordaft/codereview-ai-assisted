import { cancelReviewWorkflow, registerReviewController, reviewWorkflow, type ReviewGraphState } from './review-graph'
import { type HumanReviewDecision, ReviewStatus } from './enums'

export type { HumanReviewDecision }
export { cancelReviewWorkflow }

function threadConfig(reviewId: number) {
  return { configurable: { thread_id: `review-${reviewId}` } }
}

export async function startReviewWorkflow(reviewId: number) {
  registerReviewController(reviewId)
  return reviewWorkflow.invoke(
    {
      reviewId,
      status: ReviewStatus.PENDING,
    },
    threadConfig(reviewId),
  )
}

export async function resumeReviewWorkflow(reviewId: number, decision: HumanReviewDecision) {
  return reviewWorkflow.invoke(
    {
      reviewId,
      status: ReviewStatus.IN_PROGRESS,
      humanDecision: decision,
    },
    threadConfig(reviewId),
  )
}

export function isWorkflowState(value: unknown): value is ReviewGraphState {
  return typeof value === 'object' && value !== null && 'reviewId' in value && 'status' in value
}
