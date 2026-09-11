import {
  Annotation,
  END,
  MemorySaver,
  START,
  StateGraph,
} from '@langchain/langgraph'
import { clearSlmSuggestions, listReviewFiles, saveSlmSuggestions, updateReviewProgress, updateReviewStatus } from './review-db'
import { analyzeFileWithSlm } from './slm-client'
import { selectAnalyzableReviewFiles } from './review-scope'
import { emitReviewProgress } from './review-events'
import { trace } from './diagnostics'

export type ReviewGraphStatus = 'Pendiente' | 'En preparacion' | 'En curso' | 'Cerrada' | 'Aprobada'

export interface ReviewSuggestion {
  id: string
  filePath: string
  line: number
  severity: 'baja' | 'media' | 'alta'
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
  humanDecision: Annotation<'continue' | 'close' | 'approve'>,
})

async function acquireReviewData(state: typeof ReviewState.State) {
  const files = await listReviewFiles(state.reviewId)
  return {
    reviewId: state.reviewId,
    status: 'En preparacion' as const,
    sourceFiles: files.map((file) => file.path),
  }
}

async function analyzeWithLocalSlm(state: typeof ReviewState.State) {
  const files = await listReviewFiles(state.reviewId)
  const analyzableFiles = selectAnalyzableReviewFiles(files)
  trace('slm.analysis.scope', { reviewId: state.reviewId, totalFiles: files.length, analyzableFiles: analyzableFiles.length, skippedFiles: files.length - analyzableFiles.length })
  await clearSlmSuggestions(state.reviewId)
  const suggestions: ReviewSuggestion[] = []
  for (const [index, file] of analyzableFiles.entries()) {
    trace('slm.file.start', { reviewId: state.reviewId, filePath: file.path })
    const fileSuggestions = await analyzeFileWithSlm(file)
    const validSuggestions = fileSuggestions.filter((suggestion) => suggestion.filePath === file.path)
    suggestions.push(...validSuggestions)
    await saveSlmSuggestions(state.reviewId, validSuggestions)
    await updateReviewProgress(state.reviewId, Math.round(((index + 1) / analyzableFiles.length) * 100))
    emitReviewProgress(state.reviewId)
    trace('slm.file.complete', { reviewId: state.reviewId, filePath: file.path, suggestions: validSuggestions.length })
  }
  await updateReviewStatus(state.reviewId, 'En curso')
  emitReviewProgress(state.reviewId)
  return {
    status: 'En curso' as const,
    suggestions,
  }
}

function waitForHumanReview(state: typeof ReviewState.State) {
  const decision = state.humanDecision
  return {
    status: decision === 'close' ? 'Cerrada' as const : decision === 'approve' ? 'Aprobada' as const : 'En curso' as const,
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
