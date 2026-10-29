import Dexie from 'dexie'
import {
  createLangGraphMemoryTools,
  Engram,
  type CreateMemoryInput,
  type MemoryDocument,
  type MemoryHeader,
  type MemoryRecord,
  type MemorySearchResult,
  type MemoryStore,
} from 'engram-ts'
import { trace } from './diagnostics'
import type { SlmSuggestion } from './slm-client'

export const ENGRAM_DB_NAME = 'codereview-engram-memory'
export const ENGRAM_REF_PREFIX = 'engram://storage/v1/'

export type ReviewSkillName = 'skill_solid' | 'skill_security' | 'skill_quality' | 'skill_general'

export interface ScopeTaskDefinition {
  id_subtarea: string
  descripcion: string
  skill_requerida?: ReviewSkillName
  lineStart?: number
  lineEnd?: number
  datos_de_entrada?: Record<string, unknown>
  requiere_sub_planificacion?: boolean
}

export interface ScopeExecutionResult {
  id_scope: string
  engram_ref: string
  memoryId: string
  sumario_ejecutivo: string
  suggestions: SlmSuggestion[]
  fromMemoryCache?: boolean
  isAggregated?: boolean
  depth: number
}

export interface ReducedScopeSummary {
  id_scope: string
  engram_ref: string
  sumario_ejecutivo: string
  total_hallazgos: number
  hallazgos_resumen: Array<{
    id: string
    line: number
    severity: number
    category: number
    message: string
  }>
}

export interface InFlightScopeEntry {
  ownerScopeId: string
  promise: Promise<ScopeExecutionResult>
}

/**
 * Fast, non-blocking MemoryStore implementation for `engram-ts` that keeps
 * Lunr full-text indexing isolated per review session without blocking the browser UI thread
 * on cross-review IndexedDB table scans.
 */
export class InMemoryEngramStore implements MemoryStore {
  private readonly headers = new Map<string, MemoryHeader>()
  private readonly records = new Map<string, MemoryRecord[]>()

  async create(input: CreateMemoryInput): Promise<MemoryHeader> {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const header: MemoryHeader = {
      id,
      title: input.title.trim(),
      type: input.type.trim(),
      project: input.project.trim(),
      tags: [...(input.tags ?? [])],
      recordCount: input.records.length,
      createdAt: now,
      updatedAt: now,
    }
    const memRecords: MemoryRecord[] = input.records.map((record) => ({
      ...record,
      id: crypto.randomUUID(),
      memoryId: id,
      tags: [...(record.tags ?? [])],
      createdAt: record.createdAt ?? now,
    }))
    this.headers.set(id, header)
    this.records.set(id, memRecords)
    return header
  }

  async getHeader(id: string): Promise<MemoryHeader | undefined> {
    return this.headers.get(id)
  }

  async getDocument(id: string): Promise<MemoryDocument | undefined> {
    const header = this.headers.get(id)
    if (!header) return undefined
    const records = [...(this.records.get(id) ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return { header, records }
  }

  async listHeaders(): Promise<MemoryHeader[]> {
    return [...this.headers.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async listRecords(): Promise<MemoryRecord[]> {
    const all: MemoryRecord[] = []
    for (const list of this.records.values()) {
      all.push(...list)
    }
    return all
  }

  close(): void {
    this.headers.clear()
    this.records.clear()
  }
}

export function normalizeScopeKeyText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function hashCodeSlice(text: string): string {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

export function computeScopeSignature(params: {
  filePath: string
  skill?: string
  lineStart?: number
  lineEnd?: number
  codeSlice: string
  descripcion: string
}): { sigTag: string; topicTag: string; sliceTag: string } {
  const normSkill = normalizeScopeKeyText(params.skill ?? 'skill_general') || 'skill_general'
  const rangeStr = `${params.lineStart ?? 1}-${params.lineEnd ?? 'end'}`
  const codeHash = hashCodeSlice(params.codeSlice.trim())
  const normDesc = normalizeScopeKeyText(params.descripcion)
  const descWords = normDesc
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 10)
    .join('_')
  const descHash = hashCodeSlice(descWords || normDesc)

  return {
    // Both sigTag and topicTag include descHash so distinct tasks on the same code range never collide
    sigTag: `sig:${params.filePath}:${rangeStr}:${normSkill}:${codeHash}:${descHash}`,
    topicTag: `topic:${params.filePath}:${rangeStr}:${normSkill}:${descHash}`,
    sliceTag: `slice:${codeHash}:${descHash}`,
  }
}

export function toEngramRef(memoryId: string): string {
  return `${ENGRAM_REF_PREFIX}${memoryId}`
}

export function fromEngramRef(refOrId: string): string {
  const trimmed = refOrId.trim()
  if (trimmed.startsWith(ENGRAM_REF_PREFIX)) {
    return trimmed.slice(ENGRAM_REF_PREFIX.length)
  }
  return trimmed
}

export function toReducedScopeSummary(result: ScopeExecutionResult): ReducedScopeSummary {
  return {
    id_scope: result.id_scope,
    engram_ref: result.engram_ref,
    sumario_ejecutivo: result.sumario_ejecutivo,
    total_hallazgos: result.suggestions.length,
    hallazgos_resumen: result.suggestions.map((s) => ({
      id: s.id,
      line: s.line,
      severity: s.severity,
      category: s.category,
      message: s.message,
    })),
  }
}

let sharedEngramInstance: Engram | undefined

/**
 * Creates a fresh, isolated `Engram` instance for a review run so that Lunr index rebuilds
 * stay O(current_review_scopes) and never block the browser UI thread scanning historical reviews.
 */
export function createReviewEngram(customStore?: MemoryStore): Engram {
  return new Engram({ store: customStore ?? new InMemoryEngramStore() })
}

export function getSharedEngram(customStore?: MemoryStore): Engram {
  if (customStore) {
    return new Engram({ store: customStore })
  }
  if (!sharedEngramInstance) {
    sharedEngramInstance = new Engram({ store: new InMemoryEngramStore() })
  }
  return sharedEngramInstance
}

export async function resetEngramMemoryDatabase(): Promise<void> {
  if (sharedEngramInstance) {
    try {
      sharedEngramInstance.close()
    } catch {
      // Ignore close errors
    }
    sharedEngramInstance = undefined
  }
  if (typeof indexedDB !== 'undefined') {
    try {
      await Dexie.delete(ENGRAM_DB_NAME)
    } catch (err) {
      console.warn('[Engram] Error eliminando base de datos engram-ts:', err)
    }
  }
}

export interface ReviewScopeStorageOptions {
  engram?: Engram
  project: string
  filePath: string
  scopeId: string
  parentScopeId?: string
  ancestorScopeIds?: Set<string>
  depth?: number
  inFlightMap?: Map<string, InFlightScopeEntry>
  scopeIdToMemoryIdMap?: Map<string, string>
}

/**
 * Hierarchical Scope Storage backed by engram-ts.
 * Manages saving decomposed task plans, atomic/consolidated scope results,
 * progressive disclosure via compact headers, and deadlock-free reuse of previously
 * executed sub-scopes across the review tree.
 */
export class ReviewScopeStorage {
  readonly engram: Engram
  readonly project: string
  readonly filePath: string
  readonly scopeId: string
  readonly parentScopeId?: string
  readonly ancestorScopeIds: Set<string>
  readonly depth: number
  private readonly inFlightMap: Map<string, InFlightScopeEntry>
  private readonly scopeIdToMemoryIdMap: Map<string, string>

  constructor(options: ReviewScopeStorageOptions) {
    this.engram = options.engram ?? getSharedEngram()
    this.project = options.project
    this.filePath = options.filePath
    this.scopeId = options.scopeId
    this.parentScopeId = options.parentScopeId
    this.ancestorScopeIds = options.ancestorScopeIds ?? new Set<string>()
    this.depth = options.depth ?? 0
    this.inFlightMap = options.inFlightMap ?? new Map<string, InFlightScopeEntry>()
    this.scopeIdToMemoryIdMap = options.scopeIdToMemoryIdMap ?? new Map<string, string>()
  }

  /**
   * Creates an isolated child Scope Storage node descending from the current scope.
   * Records `this.scopeId` in `ancestorScopeIds` so a child can NEVER deadlock awaiting an ancestor.
   */
  createChildScopeStorage(childScopeId: string): ReviewScopeStorage {
    const nextAncestors = new Set(this.ancestorScopeIds)
    nextAncestors.add(this.scopeId)
    return new ReviewScopeStorage({
      engram: this.engram,
      project: this.project,
      filePath: this.filePath,
      scopeId: childScopeId,
      parentScopeId: this.scopeId,
      ancestorScopeIds: nextAncestors,
      depth: this.depth + 1,
      inFlightMap: this.inFlightMap,
      scopeIdToMemoryIdMap: this.scopeIdToMemoryIdMap,
    })
  }

  /**
   * Exposes the standard LangGraph tools (`memory_search`, `memory_get`, `memory_save`)
   * provided by `engram-ts`.
   */
  getLangGraphTools() {
    return createLangGraphMemoryTools(this.engram)
  }

  /**
   * Looks up an in-flight scope execution from a sibling/peer branch, strictly ignoring
   * self and any ancestor scopes to prevent parent-child deadlocks.
   */
  getInFlight(signatureKey: string): Promise<ScopeExecutionResult> | undefined {
    const entry = this.inFlightMap.get(signatureKey)
    if (!entry) return undefined
    if (entry.ownerScopeId === this.scopeId || this.ancestorScopeIds.has(entry.ownerScopeId)) {
      return undefined
    }
    return entry.promise
  }

  setInFlight(signatureKey: string, promise: Promise<ScopeExecutionResult>): void {
    const existing = this.inFlightMap.get(signatureKey)
    if (existing && this.ancestorScopeIds.has(existing.ownerScopeId)) {
      return
    }
    this.inFlightMap.set(signatureKey, {
      ownerScopeId: this.scopeId,
      promise,
    })
  }

  clearInFlight(signatureKey: string): void {
    const existing = this.inFlightMap.get(signatureKey)
    if (existing && existing.ownerScopeId === this.scopeId) {
      this.inFlightMap.delete(signatureKey)
    }
  }

  /**
   * Persists the decomposed sub-task plan in the current Scope Storage via `engram-ts`.
   */
  async saveSubPlan(subPlan: ScopeTaskDefinition[], justification?: string): Promise<MemoryHeader> {
    const header = await this.engram.save({
      title: `Plan de Scope ${this.scopeId} (${subPlan.length} subtareas)`,
      type: 'scope-plan',
      project: this.project,
      tags: [
        'scope-plan',
        `scope:${this.scopeId}`,
        ...(this.parentScopeId ? [`parent:${this.parentScopeId}`] : []),
        `file:${this.filePath}`,
        `depth:${this.depth}`,
      ],
      records: [
        {
          title: 'manifiesto_subtareas',
          content: JSON.stringify({
            id_scope: this.scopeId,
            parent_scope: this.parentScopeId ?? null,
            depth: this.depth,
            justificacion: justification ?? 'Descomposición recursiva de tarea compleja',
            subtareas: subPlan,
          }),
          tags: ['plan', `scope:${this.scopeId}`],
        },
      ],
    })

    trace('engram.scope.plan_saved', {
      scopeId: this.scopeId,
      parentScopeId: this.parentScopeId,
      depth: this.depth,
      memoryId: header.id,
      subtasksCount: subPlan.length,
    })

    return header
  }

  /**
   * Persists an atomic or aggregated Scope result into `engram-ts` and returns the full ScopeExecutionResult.
   */
  async saveScopeResult(params: {
    task: ScopeTaskDefinition
    codeSlice: string
    sumarioEjecutivo: string
    suggestions: SlmSuggestion[]
    isAggregated?: boolean
  }): Promise<ScopeExecutionResult> {
    const { sigTag, topicTag, sliceTag } = computeScopeSignature({
      filePath: this.filePath,
      skill: params.task.skill_requerida,
      lineStart: params.task.lineStart,
      lineEnd: params.task.lineEnd,
      codeSlice: params.codeSlice,
      descripcion: params.task.descripcion,
    })

    const summaryText = params.sumarioEjecutivo.trim() ||
      `Scope ${this.scopeId} completado con ${params.suggestions.length} hallazgo(s) en ${this.filePath}.`

    const header = await this.engram.save({
      title: summaryText.slice(0, 160),
      type: params.isAggregated ? 'scope-synthesis' : 'scope-atomic-result',
      project: this.project,
      tags: [
        'scope-result',
        params.isAggregated ? 'scope-synthesis' : 'scope-atomic-result',
        `scope:${this.scopeId}`,
        ...(this.parentScopeId ? [`parent:${this.parentScopeId}`] : []),
        `file:${this.filePath}`,
        `skill:${params.task.skill_requerida ?? 'skill_general'}`,
        `range:${params.task.lineStart ?? 1}-${params.task.lineEnd ?? 'end'}`,
        `depth:${this.depth}`,
        sigTag,
        topicTag,
        sliceTag,
      ],
      records: [
        {
          title: 'sumario_ejecutivo',
          content: JSON.stringify({
            id_scope: this.scopeId,
            filePath: this.filePath,
            skill: params.task.skill_requerida ?? 'skill_general',
            lineStart: params.task.lineStart ?? 1,
            lineEnd: params.task.lineEnd ?? null,
            descripcion: params.task.descripcion,
            sumario_ejecutivo: summaryText,
            suggestionsCount: params.suggestions.length,
          }),
          tags: ['summary', `scope:${this.scopeId}`, sigTag, topicTag],
        },
        {
          title: 'suggestions_payload',
          content: JSON.stringify({
            suggestions: params.suggestions,
          }),
          tags: ['suggestions', `scope:${this.scopeId}`, `file:${this.filePath}`],
        },
      ],
    })

    this.scopeIdToMemoryIdMap.set(this.scopeId, header.id)
    if (params.task.id_subtarea) {
      this.scopeIdToMemoryIdMap.set(params.task.id_subtarea, header.id)
    }

    const result: ScopeExecutionResult = {
      id_scope: this.scopeId,
      engram_ref: toEngramRef(header.id),
      memoryId: header.id,
      sumario_ejecutivo: summaryText,
      suggestions: params.suggestions,
      fromMemoryCache: false,
      isAggregated: Boolean(params.isAggregated),
      depth: this.depth,
    }

    trace('engram.scope.result_saved', {
      scopeId: this.scopeId,
      parentScopeId: this.parentScopeId,
      depth: this.depth,
      memoryId: header.id,
      engramRef: result.engram_ref,
      suggestionsCount: params.suggestions.length,
      isAggregated: Boolean(params.isAggregated),
    })

    return result
  }

  /**
   * Lists compact MemoryHeaders of completed scopes related to the current file/task
   * without loading full record payloads into context.
   */
  async listRelatedScopeHeaders(task: ScopeTaskDefinition, limit = 8): Promise<MemoryHeader[]> {
    const queryTerms = `${this.filePath} ${task.skill_requerida ?? ''} ${task.descripcion}`.trim()
    let results: MemorySearchResult[] = []
    try {
      results = await this.engram.search({
        query: queryTerms,
        project: this.project,
        limit: limit * 2,
      })
    } catch {
      results = []
    }
    if (results.length === 0) {
      try {
        results = await this.engram.search({
          query: '',
          project: this.project,
          limit: limit * 2,
        })
      } catch {
        results = []
      }
    }

    return results
      .map((r) => r.header)
      .filter(
        (h) =>
          h.tags.includes('scope-result') &&
          h.tags.includes(`file:${this.filePath}`) &&
          ![...this.ancestorScopeIds].some((ancId) => h.tags.includes(`scope:${ancId}`)),
      )
      .slice(0, limit)
  }

  /**
   * Searches `engram-ts` to determine if an equivalent sub-scope was already executed
   * in another sub-scope. If found, loads the full MemoryDocument by ID and returns
   * the cached ScopeExecutionResult so no additional scope is spawned.
   */
  async findReusableScopeResult(
    task: ScopeTaskDefinition,
    codeSlice: string,
  ): Promise<ScopeExecutionResult | undefined> {
    const { sigTag, topicTag, sliceTag } = computeScopeSignature({
      filePath: this.filePath,
      skill: task.skill_requerida,
      lineStart: task.lineStart,
      lineEnd: task.lineEnd,
      codeSlice,
      descripcion: task.descripcion,
    })

    // 1. Check in-flight concurrent sibling executions (never self or ancestors)
    const inFlight = this.getInFlight(sigTag) ?? this.getInFlight(topicTag)
    if (inFlight) {
      trace('engram.scope.inflight_awaiting', {
        requestedScopeId: this.scopeId,
        sigTag,
      })
      const resolved = await inFlight
      trace('engram.scope.inflight_reused', {
        requestedScopeId: this.scopeId,
        reusedScopeId: resolved.id_scope,
        engramRef: resolved.engram_ref,
      })
      return {
        ...resolved,
        fromMemoryCache: true,
      }
    }

    // 2. Search persisted headers in engram-ts
    let candidates: MemorySearchResult[] = []
    try {
      candidates = await this.engram.search({
        query: '',
        project: this.project,
        limit: 100,
      })
    } catch {
      candidates = []
    }

    const resultHeaders = candidates
      .map((c) => c.header)
      .filter(
        (h) =>
          h.tags.includes('scope-result') &&
          ![...this.ancestorScopeIds].some((ancId) => h.tags.includes(`scope:${ancId}`)),
      )

    const targetSkillTag = `skill:${task.skill_requerida ?? 'skill_general'}`
    const matchedHeader = resultHeaders.find((header) => {
      // Exact code-slice + skill + range + description signature match
      if (header.tags.includes(sigTag)) return true
      // Exact file + range + skill + normalized task topic match
      if (header.tags.includes(topicTag)) return true
      // Same code slice + task description fingerprint + same skill
      if (header.tags.includes(sliceTag) && header.tags.includes(targetSkillTag) && header.tags.includes(`file:${this.filePath}`)) {
        return true
      }
      // Same explicit non-ancestor scope ID already completed in this file
      if (
        task.id_subtarea &&
        !this.ancestorScopeIds.has(task.id_subtarea) &&
        header.tags.includes(`scope:${task.id_subtarea}`) &&
        header.tags.includes(`file:${this.filePath}`)
      ) {
        return true
      }
      return false
    })

    if (!matchedHeader) {
      return undefined
    }

    return this.getScopeResultByMemoryId(matchedHeader.id)
  }

  /**
   * Loads a full MemoryDocument from `engram-ts` by memory ID (or `engram://` ref or `id_scope`)
   * and reconstructs the ScopeExecutionResult.
   */
  async getScopeResultByMemoryId(idOrRefOrScopeId: string): Promise<ScopeExecutionResult | undefined> {
    const cleanKey = fromEngramRef(idOrRefOrScopeId)
    const mappedMemoryId = this.scopeIdToMemoryIdMap.get(cleanKey) ?? cleanKey

    let doc = await this.engram.getById(mappedMemoryId)
    if (!doc) {
      // Fallback: search by scope tag if an id_scope was provided instead of a UUID
      const all = await this.engram.search({ query: '', project: this.project, limit: 100 })
      const byScopeTag = all.find(
        ({ header }) =>
          header.tags.includes('scope-result') &&
          (header.tags.includes(`scope:${cleanKey}`) || header.id === cleanKey),
      )
      if (byScopeTag) {
        doc = await this.engram.getById(byScopeTag.header.id)
      }
    }

    if (!doc) return undefined

    let sumarioEjecutivo = doc.header.title
    let idScope = this.scopeId
    let suggestions: SlmSuggestion[] = []

    for (const record of doc.records) {
      if (record.title === 'sumario_ejecutivo') {
        try {
          const parsed = JSON.parse(record.content) as {
            id_scope?: string
            sumario_ejecutivo?: string
          }
          if (parsed.sumario_ejecutivo) sumarioEjecutivo = parsed.sumario_ejecutivo
          if (parsed.id_scope) idScope = parsed.id_scope
        } catch {
          // Keep header title fallback
        }
      } else if (record.title === 'suggestions_payload') {
        try {
          const parsed = JSON.parse(record.content) as { suggestions?: SlmSuggestion[] }
          if (Array.isArray(parsed.suggestions)) {
            suggestions = parsed.suggestions
          }
        } catch {
          // Ignore malformed payload
        }
      }
    }

    trace('engram.scope.memory_loaded', {
      requestedKey: idOrRefOrScopeId,
      memoryId: doc.header.id,
      scopeId: idScope,
      suggestionsCount: suggestions.length,
    })

    return {
      id_scope: idScope,
      engram_ref: toEngramRef(doc.header.id),
      memoryId: doc.header.id,
      sumario_ejecutivo: sumarioEjecutivo,
      suggestions,
      fromMemoryCache: true,
      isAggregated: doc.header.type === 'scope-synthesis',
      depth: this.depth,
    }
  }
}
