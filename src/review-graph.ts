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

const activeReviewControllers = new Map<number, AbortController>()

export function registerReviewController(reviewId: number): AbortController {
  const existing = activeReviewControllers.get(reviewId)
  if (existing) {
    existing.abort()
  }
  const controller = new AbortController()
  activeReviewControllers.set(reviewId, controller)
  return controller
}

export function getReviewController(reviewId: number): AbortController | undefined {
  return activeReviewControllers.get(reviewId)
}

export function cancelReviewWorkflow(reviewId: number): void {
  const controller = activeReviewControllers.get(reviewId)
  if (controller) {
    controller.abort()
    activeReviewControllers.delete(reviewId)
  }
  emitReviewThinking({
    reviewId,
    phase: 'completed',
  })
}

async function acquireReviewData(state: typeof ReviewState.State) {
  const controller = getReviewController(state.reviewId)
  if (controller?.signal.aborted) {
    return {
      reviewId: state.reviewId,
      status: ReviewStatus.CLOSED,
      sourceFiles: [],
    }
  }
  const files = await listReviewFiles(state.reviewId)
  emitReviewProgress(state.reviewId)
  return {
    reviewId: state.reviewId,
    status: ReviewStatus.IN_PREPARATION,
    sourceFiles: files.map((file) => file.path),
  }
}

async function analyzeWithLocalSlm(state: typeof ReviewState.State) {
  const controller = getReviewController(state.reviewId) ?? registerReviewController(state.reviewId)
  const signal = controller.signal

  if (signal.aborted) {
    emitReviewThinking({ reviewId: state.reviewId, phase: 'completed' })
    await updateReviewStatus(state.reviewId, ReviewStatus.CLOSED)
    emitReviewProgress(state.reviewId)
    return {
      status: ReviewStatus.CLOSED,
      suggestions: [],
    }
  }

  const startedAt = performance.now()
  const files = await listReviewFiles(state.reviewId)
  const analyzableFiles = selectAnalyzableReviewFiles(files)
  trace('slm.analysis.scope', { reviewId: state.reviewId, totalFiles: files.length, analyzableFiles: analyzableFiles.length, skippedFiles: files.length - analyzableFiles.length })
  await clearSlmSuggestions(state.reviewId)
  const suggestions: ReviewSuggestion[] = []
  for (const [index, file] of analyzableFiles.entries()) {
    if (signal.aborted) {
      trace('slm.analysis.aborted', { reviewId: state.reviewId, atFile: file.path })
      break
    }

    trace('slm.file.start', { reviewId: state.reviewId, filePath: file.path })
    emitReviewThinking({
      reviewId: state.reviewId,
      filePath: file.path,
      fileIndex: index + 1,
      totalFiles: analyzableFiles.length,
      phase: 'thinking',
    })

    let fileSuggestions: ReturnType<typeof analyzeFileWithSlm> extends Promise<infer T> ? T : never = []
    try {
      fileSuggestions = await analyzeFileWithSlm(
        file,
        async (streamedSuggestion) => {
          if (signal.aborted) return
          trace('slm.graph.streamed_suggestion_received', {
            reviewId: state.reviewId,
            filePath: file.path,
            suggestionId: streamedSuggestion.id,
            line: streamedSuggestion.line,
          })
          const suggestionToSave = {
            ...streamedSuggestion,
            filePath: file.path,
          }
          try {
            await saveSlmSuggestions(state.reviewId, [suggestionToSave])
            emitReviewThinking({
              reviewId: state.reviewId,
              filePath: file.path,
              fileIndex: index + 1,
              totalFiles: analyzableFiles.length,
              phase: 'suggesting',
            })
            emitReviewProgress(state.reviewId)
          } catch (saveErr) {
            trace('slm.graph.streamed_save_error', {
              reviewId: state.reviewId,
              filePath: file.path,
              suggestionId: streamedSuggestion.id,
              error: saveErr,
            })
          }
        },
        (thought) => {
          if (signal.aborted) return
          emitReviewThinking({
            reviewId: state.reviewId,
            filePath: file.path,
            fileIndex: index + 1,
            totalFiles: analyzableFiles.length,
            thought,
            phase: 'thinking',
          })
        },
        signal,
      )
    } catch (err) {
      if (signal.aborted) {
        trace('slm.analysis.aborted', { reviewId: state.reviewId, atFile: file.path })
        break
      }
      trace('slm.file.error', { reviewId: state.reviewId, filePath: file.path, error: err })
    }

    if (signal.aborted) {
      trace('slm.analysis.aborted', { reviewId: state.reviewId, atFile: file.path })
      break
    }

    const validSuggestions = fileSuggestions.map((suggestion) => ({
      ...suggestion,
      filePath: file.path,
    }))
    trace('slm.graph.file_saving_batch', {
      reviewId: state.reviewId,
      filePath: file.path,
      batchCount: validSuggestions.length,
    })
    suggestions.push(...validSuggestions)
    try {
      await saveSlmSuggestions(state.reviewId, validSuggestions)
    } catch (batchSaveErr) {
      trace('slm.graph.batch_save_error', {
        reviewId: state.reviewId,
        filePath: file.path,
        error: batchSaveErr,
      })
    }
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

  activeReviewControllers.delete(state.reviewId)

  emitReviewThinking({
    reviewId: state.reviewId,
    phase: 'completed',
  })

  if (signal.aborted) {
    await updateReviewStatus(state.reviewId, ReviewStatus.CLOSED)
    emitReviewProgress(state.reviewId)
    return {
      status: ReviewStatus.CLOSED,
      suggestions,
    }
  }

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
