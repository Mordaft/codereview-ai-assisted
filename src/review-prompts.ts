export interface ReviewPromptConfig {
  reviewInstructions: string
}

export const defaultReviewInstructions = `Analiza el código aplicando principios SOLID y prácticas de seguridad.
Identifica únicamente problemas concretos, justificables y accionables.
Prioriza vulnerabilidades, errores de diseño, riesgos de mantenimiento y defectos funcionales.
No inventes contexto que no esté presente en el código o en la configuración.
Genera como máximo 5 propuestas para este fichero.
Cada propuesta debe referirse a una línea concreta que contenga o provoque el problema.
No repitas la misma observación en varias líneas: si un problema afecta a muchas líneas, informa solo de la línea más representativa.
No generes recomendaciones genéricas, de estilo superficial o aplicables indistintamente a todas las líneas.
Si no existe un problema concreto, devuelve una lista suggestions vacía.
Vincula cada hallazgo al fichero y línea exactos.`

export const reviewOutputContract = `CONTRATO OBLIGATORIO. Responde exclusivamente con un objeto JSON válido, sin markdown ni texto adicional:
{
  "suggestions": [
    {
      "id": "string",
      "filePath": "string",
      "line": 1,
      "severity": "baja | media | alta",
      "category": "solid | security | quality",
      "message": "string",
      "recommendation": "string"
    }
  ]
}
Reglas del contrato: suggestions debe ser siempre un array; line debe ser un número entero; filePath debe coincidir con el fichero analizado; no incluyas propiedades adicionales.`

const storageKey = 'codereview-review-prompts'

export function getReviewPromptConfig(): ReviewPromptConfig {
  const savedConfig = localStorage.getItem(storageKey)
  if (!savedConfig) return { reviewInstructions: defaultReviewInstructions }
  try {
    const parsed = JSON.parse(savedConfig) as Partial<ReviewPromptConfig>
    return {
      reviewInstructions: typeof parsed.reviewInstructions === 'string' && parsed.reviewInstructions.trim() ? parsed.reviewInstructions : defaultReviewInstructions,
    }
  } catch {
    return { reviewInstructions: defaultReviewInstructions }
  }
}

export function saveReviewPromptConfig(config: ReviewPromptConfig) {
  if (!config.reviewInstructions.trim()) throw new Error('Las instrucciones de revisión no pueden estar vacías.')
  localStorage.setItem(storageKey, JSON.stringify({ reviewInstructions: config.reviewInstructions.trim() }))
}
