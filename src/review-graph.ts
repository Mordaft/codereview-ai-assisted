import {
  Annotation,
  END,
  MemorySaver,
  START,
  StateGraph,
} from '@langchain/langgraph'
import { clearSlmSuggestions, listReviewFiles, saveSlmSuggestions, updateReviewAnalysisMetrics, updateReviewProgress, updateReviewStatus } from './review-db'
import { analyzeFileWithSlm } from './slm-client'
import { getSlmConfig } from './slm-config'
import { selectAnalyzableReviewFiles } from './review-scope'
import { emitReviewProgress, emitReviewThinking } from './review-events'
import { trace } from './diagnostics'
import {
  type CommentSeverity,
  type HumanReviewDecision,
  ReviewAction,
  type ReviewStatus as ReviewStatusType,
  ReviewStatus,
} from './enums'

export type ReviewGraphStatus = ReviewStatusType

export interface ReviewSuggestion {
  id: string
  filePath: string
  line: number
  severity: CommentSeverity
  message: string
  recommendation: string
}

const ReviewState = Annotation.Root({
  reviewId: Annotation<number>,
  status: Annotation<ReviewGraphStatus>,
  sourceFiles: Annotation<string[]>({
    reducer: (current, update) => update ?? current,
    default: () => [],
  }),
  suggestions: Annotation<ReviewSuggestion[]>({
    reducer: (current, update) => update ?? current,
    default: () => [],
  }),
  humanDecision: Annotation<HumanReviewDecision>,
})

async function acquireReviewData(state: typeof ReviewState.State) {
  const files = await listReviewFiles(state.reviewId)
  return {
    reviewId: state.reviewId,
    status: ReviewStatus.IN_PREPARATION,
    sourceFiles: files.map((file) => file.path),
  }
}

async function analyzeWithLocalSlm(state: typeof ReviewState.State) {
  const startedAt = performance.now()
  const files = await listReviewFiles(state.reviewId)
  const analyzableFiles = selectAnalyzableReviewFiles(files)
  trace('slm.analysis.scope', { reviewId: state.reviewId, totalFiles: files.length, analyzableFiles: analyzableFiles.length, skippedFiles: files.length - analyzableFiles.length })
  await clearSlmSuggestions(state.reviewId)
  const suggestions: ReviewSuggestion[] = []
  for (const [index, file] of analyzableFiles.entries()) {
    trace('slm.file.start', { reviewId: state.reviewId, filePath: file.path })
    emitReviewThinking({
      reviewId: state.reviewId,
      filePath: file.path,
      fileIndex: index + 1,
      totalFiles: analyzableFiles.length,
      phase: 'thinking',
    })
    const fileSuggestions = await analyzeFileWithSlm(
      file,
      async (streamedSuggestion) => {
        if (streamedSuggestion.filePath === file.path) {
          await saveSlmSuggestions(state.reviewId, [streamedSuggestion])
          emitReviewThinking({
            reviewId: state.reviewId,
            filePath: file.path,
            fileIndex: index + 1,
            totalFiles: analyzableFiles.length,
            phase: 'suggesting',
          })
          emitReviewProgress(state.reviewId)
        }
      },
      (thought) => {
        emitReviewThinking({
          reviewId: state.reviewId,
          filePath: file.path,
          fileIndex: index + 1,
          totalFiles: analyzableFiles.length,
          thought,
          phase: 'thinking',
        })
      },
    )
    const validSuggestions = fileSuggestions.filter((suggestion) => suggestion.filePath === file.path)
    suggestions.push(...validSuggestions)
    await saveSlmSuggestions(state.reviewId, validSuggestions)
    await updateReviewProgress(state.reviewId, Math.round(((index + 1) / analyzableFiles.length) * 100))
    emitReviewProgress(state.reviewId)
    trace('slm.file.complete', { reviewId: state.reviewId, filePath: file.path, suggestions: validSuggestions.length })
  }
  const elapsedMs = Math.round(performance.now() - startedAt)
  await updateReviewAnalysisMetrics(state.reviewId, {
    processingTimeMs: elapsedMs,
    processedFilesCount: analyzableFiles.length,
    model: getSlmConfig().model,
  })
  emitReviewThinking({
    reviewId: state.reviewId,
    phase: 'completed',
  })
  await updateReviewStatus(state.reviewId, ReviewStatus.IN_PROGRESS)
  emitReviewProgress(state.reviewId)
  return {
    status: ReviewStatus.IN_PROGRESS,
    suggestions,
  }
}

function waitForHumanReview(state: typeof ReviewState.State) {
  const decision = state.humanDecision
  return {
    status: decision === ReviewAction.CLOSE
      ? ReviewStatus.CLOSED
      : decision === ReviewAction.APPROVE
      ? ReviewStatus.APPROVED
      : ReviewStatus.IN_PROGRESS,
  }
}

const reviewGraph = new StateGraph(ReviewState)
  .addNode('acquireReviewData', acquireReviewData)
  .addNode('analyzeWithLocalSlm', analyzeWithLocalSlm)
  .addNode('waitForHumanReview', waitForHumanReview)
  .addEdge(START, 'acquireReviewData')
  .addEdge('acquireReviewData', 'analyzeWithLocalSlm')
  .addEdge('analyzeWithLocalSlm', 'waitForHumanReview')
  .addEdge('waitForHumanReview', END)

export const reviewWorkflow = reviewGraph.compile({
  checkpointer: new MemorySaver(),
})

export type ReviewGraphState = typeof ReviewState.State
