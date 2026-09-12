export interface DiagnosticEvent {
  at: string
  event: string
  details?: Record<string, unknown>
}

const storageKey = 'codereview-diagnostics'
const maxEvents = 100

function safeDetails(details?: Record<string, unknown>) {
  if (!details) return undefined
  return Object.fromEntries(Object.entries(details).filter(([key]) => !/token|authorization|^content$|^patch$|body/i.test(key)))
}

export function trace(event: string, details?: Record<string, unknown>) {
  const entry: DiagnosticEvent = { at: new Date().toISOString(), event, details: safeDetails(details) }
  console.info(`[CodeReview AI] ${entry.event}`, entry.details ?? '')
  try {
    const previous = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]') as DiagnosticEvent[]
    sessionStorage.setItem(storageKey, JSON.stringify([...previous, entry].slice(-maxEvents)))
  } catch {
    // Diagnostics must never interrupt the review flow.
  }
}

export function getDiagnostics() {
  try {
    return sessionStorage.getItem(storageKey) ?? '[]'
  } catch {
    return '[]'
  }
}

export function clearDiagnostics() {
  sessionStorage.removeItem(storageKey)
}
