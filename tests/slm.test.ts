import assert from 'node:assert/strict'
import { parseSuggestions, filterSuggestions } from '../src/slm-client'
import { CommentCategory, CommentSeverity } from '../src/enums'

console.log('--- Iniciando pruebas de Parsing y Resiliencia de Sugerencias SLM ---')

// Test 1: JSON estándar con array de sugerencias
{
  console.log('Test 1: JSON estándar con array de sugerencias')
  const json = JSON.stringify({
    suggestions: [
      {
        id: 'sug-1',
        filePath: 'src/main/java/com/caixabank/Service.java',
        line: 42,
        severity: 'alta',
        category: 'security',
        message: 'Posible inyección SQL detectada',
        recommendation: 'Utilizar parámetros preparados en lugar de concatenar cadenas',
      },
    ],
  })
  const parsed = parseSuggestions(json, false)
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].filePath, 'src/main/java/com/caixabank/Service.java')
  assert.equal(parsed[0].severity, CommentSeverity.HIGH)
  assert.equal(parsed[0].category, CommentCategory.SECURITY)
}

// Test 2: Fallback de filePath para rutas profundas de GitLab
{
  console.log('Test 2: Fallback de filePath para rutas profundas de GitLab')
  const gitlabDeepPath = 'CustomerOfferCPC-micro/src/main/java/com/caixabank/absis/apps/service/cbk/sales/customerofferCPC/service/dto/CustomerOfferDTO.java'
  // El modelo a menudo devuelve sólo el nombre del fichero o una ruta relativa incompleta
  const jsonWithShortPath = JSON.stringify({
    suggestions: [
      {
        id: '1',
        filePath: 'CustomerOfferDTO.java',
        line: 15,
        severity: 'media',
        category: 'solid',
        message: 'Violación del principio de responsabilidad única',
        recommendation: 'Extraer la lógica de cálculo a una clase auxiliar',
      },
    ],
  })
  const parsed = parseSuggestions(jsonWithShortPath, false, gitlabDeepPath)
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].filePath, gitlabDeepPath, 'El filePath debe coincidir con la ruta completa del fichero bajo revisión')
}

// Test 3: Normalización de severidades y categorías laxas (español, inglés, alias)
{
  console.log('Test 3: Normalización de severidades y categorías laxas')
  const rawList = JSON.stringify({
    suggestions: [
      {
        message: 'Fallo crítico de memoria en bucle',
        recommendation: 'Liberar recursos adecuadamente',
        severity: 'critical',
        category: 'calidad',
      },
      {
        message: 'Uso de algoritmo inseguro MD5',
        recommendation: 'Migrar a SHA-256',
        severity: 'alta',
        category: 'seguridad',
      },
      {
        message: 'Acoplamiento excesivo entre componentes',
        recommendation: 'Invertir dependencias mediante interfaces',
        severity: 'baja',
        category: 'diseño',
      },
    ],
  })
  const parsed = parseSuggestions(rawList, false, 'src/example.ts')
  assert.equal(parsed.length, 3)
  assert.equal(parsed[0].severity, CommentSeverity.HIGH)
  assert.equal(parsed[0].category, CommentCategory.QUALITY)
  assert.equal(parsed[1].severity, CommentSeverity.HIGH)
  assert.equal(parsed[1].category, CommentCategory.SECURITY)
  assert.equal(parsed[2].severity, CommentSeverity.LOW)
  assert.equal(parsed[2].category, CommentCategory.SOLID)
}

// Test 4: Recuperación de JSON truncado por límite de tokens (finishReason === 'length')
{
  console.log('Test 4: Recuperación de JSON truncado por límite de tokens')
  // Simular que el modelo agotó tokens a mitad de generar el segundo objeto
  const truncatedStream = `{"suggestions": [
    {
      "id": "1",
      "filePath": "OrderService.java",
      "line": 88,
      "severity": "alta",
      "category": "security",
      "message": "Falta de validación en parámetro sensible",
      "recommendation": "Agregar validación de esquema en la entrada"
    },
    {
      "id": "2",
      "filePath": "OrderService.java",
      "line": 105,
      "severity": "media",
      "message": "Incompleto`
  
  const parsed = parseSuggestions(truncatedStream, true, 'services/OrderService.java')
  assert.equal(parsed.length, 1, 'Debe haber recuperado la primera sugerencia completa')
  assert.equal(parsed[0].filePath, 'services/OrderService.java')
  assert.equal(parsed[0].line, 88)
}

// Test 5: Filtrado de sugerencias genéricas y deduplicación
{
  console.log('Test 5: Filtrado de sugerencias genéricas y deduplicación')
  const suggestions = [
    {
      id: 'g1',
      filePath: 'A.java',
      line: 1,
      severity: CommentSeverity.LOW,
      category: CommentCategory.QUALITY,
      message: 'Revisa este codigo',
      recommendation: 'Mejora la calidad del codigo',
    },
    {
      id: 'v1',
      filePath: 'A.java',
      line: 10,
      severity: CommentSeverity.HIGH,
      category: CommentCategory.SECURITY,
      message: 'Token de acceso expuesto en log',
      recommendation: 'Enmascarar tokens antes de registrar',
    },
    {
      id: 'v2',
      filePath: 'A.java',
      line: 10,
      severity: CommentSeverity.HIGH,
      category: CommentCategory.SECURITY,
      message: 'Token de acceso expuesto en log',
      recommendation: 'Enmascarar tokens antes de registrar',
    },
  ]
  const filtered = filterSuggestions(suggestions)
  assert.equal(filtered.length, 1, 'Solo debe quedar la sugerencia válida y deduplicada')
  assert.equal(filtered[0].id, 'v1')
}

console.log('✓ Todas las pruebas de Sugerencias SLM pasaron exitosamente.')
