import assert from 'node:assert/strict'
import { Engram } from 'engram-ts'
import {
  InMemoryEngramStore,
  ReviewScopeStorage,
  ENGRAM_REF_PREFIX,
  toEngramRef,
  fromEngramRef,
} from '../src/review-memory'
import {
  analyzeFileWithSlm,
  buildStep1ScopeTools,
  procesarNodoScope,
  runWithConcurrency,
  SlmConcurrencyGate,
} from '../src/slm-client'
import { CommentCategory, CommentSeverity } from '../src/enums'
import type { StoredReviewFile } from '../src/review-db'

console.log('--- Iniciando pruebas de Memoria Engram-ts y Orquestación Recursiva por Scopes ---')

function createSseToolCallResponse(toolName: string, args: Record<string, unknown>, thought?: string): Response {
  const encoder = new TextEncoder()
  const argsStr = JSON.stringify(args)
  const mid = Math.floor(argsStr.length / 2)
  const part1 = argsStr.slice(0, mid)
  const part2 = argsStr.slice(mid)

  const chunks: string[] = []
  if (thought) {
    chunks.push(
      `data: ${JSON.stringify({
        choices: [{ index: 0, delta: { reasoning_content: thought } }],
      })}\n\n`,
    )
  }
  chunks.push(
    `data: ${JSON.stringify({
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: `call_${toolName}_${ Math.random().toString(36).slice(2, 7)}`,
                type: 'function',
                function: { name: toolName, arguments: part1 },
              },
            ],
          },
        },
      ],
    })}\n\n`,
  )
  chunks.push(
    `data: ${JSON.stringify({
      choices: [
        {
          index: 0,
          finish_reason: 'tool_calls',
          delta: {
            tool_calls: [
              {
                index: 0,
                function: { arguments: part2 },
              },
            ],
          },
        },
      ],
    })}\n\n`,
  )
  chunks.push('data: [DONE]\n\n')

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

async function runTests() {
  // Test 1: Almacenamiento de Scopes en engram-ts, cabeceras ligeras y carga bajo demanda
  {
    console.log('Test 1: Almacenamiento jerárquico en engram-ts y divulgación progresiva')
    const engram = new Engram({ store: new InMemoryEngramStore() })
    const rootStorage = new ReviewScopeStorage({
      engram,
      project: 'review-101',
      filePath: 'src/services/PaymentService.ts',
      scopeId: 'scope_root_payment',
      depth: 0,
    })

    const langGraphTools = rootStorage.getLangGraphTools()
    assert.equal(langGraphTools.length, 3, 'Debe exponer las 3 herramientas de engram-ts (memory_search, memory_get, memory_save)')

    const planHeader = await rootStorage.saveSubPlan(
      [
        {
          id_subtarea: 'scope_payment_security',
          descripcion: 'Revisar seguridad en cobros',
          skill_requerida: 'skill_security',
          lineStart: 1,
          lineEnd: 25,
        },
      ],
      'Separación de análisis por responsabilidad crítica',
    )
    assert.ok(planHeader.id.length > 0)
    assert.equal(planHeader.type, 'scope-plan')

    const childStorage = rootStorage.createChildScopeStorage('scope_payment_security')
    assert.equal(childStorage.depth, 1)
    assert.equal(childStorage.parentScopeId, 'scope_root_payment')

    const savedResult = await childStorage.saveScopeResult({
      task: {
        id_subtarea: 'scope_payment_security',
        descripcion: 'Revisar seguridad en cobros',
        skill_requerida: 'skill_security',
        lineStart: 1,
        lineEnd: 25,
      },
      codeSlice: 'const apiKey = "sk_live_12345";',
      sumarioEjecutivo: 'Clave secreta hardcodeada detectada en línea 12.',
      suggestions: [
        {
          id: 'sec-1',
          filePath: 'src/services/PaymentService.ts',
          line: 12,
          severity: CommentSeverity.HIGH,
          category: CommentCategory.SECURITY,
          message: 'Credencial de API expuesta directamente en el código fuente',
          recommendation: 'Extraer la clave secreta a variables de entorno seguras',
        },
      ],
    })

    assert.ok(savedResult.engram_ref.startsWith(ENGRAM_REF_PREFIX))
    assert.equal(fromEngramRef(toEngramRef(savedResult.memoryId)), savedResult.memoryId)

    // Búsqueda de cabeceras ligeras (sin cargar el payload completo)
    const relatedHeaders = await rootStorage.listRelatedScopeHeaders({
      id_subtarea: 'scope_root_payment',
      descripcion: 'seguridad cobros',
      skill_requerida: 'skill_security',
    })
    assert.equal(relatedHeaders.length, 1)
    assert.equal(relatedHeaders[0].id, savedResult.memoryId)

    // Recuperación del detalle completo por referencia engram:// o id_scope
    const loadedByRef = await rootStorage.getScopeResultByMemoryId(savedResult.engram_ref)
    assert.ok(loadedByRef)
    assert.equal(loadedByRef.id_scope, 'scope_payment_security')
    assert.equal(loadedByRef.suggestions.length, 1)
    assert.equal(loadedByRef.suggestions[0].line, 12)

    const loadedByScopeId = await rootStorage.getScopeResultByMemoryId('scope_payment_security')
    assert.ok(loadedByScopeId)
    assert.equal(loadedByScopeId.memoryId, savedResult.memoryId)
  }

  // Test 2: Bucle Fractal de 3 Pasos con Function Calling nativo (descomponer -> ejecutar_tarea_atomica -> consultar_detalle_scope -> consolidar)
  {
    console.log('Test 2: Bucle recursivo de 3 pasos con Function Calling nativo (tools) y agregación')
    const engram = new Engram({ store: new InMemoryEngramStore() })
    const sampleFile: StoredReviewFile = {
      reviewId: 202,
      path: 'src/auth/AuthProcessor.ts',
      status: 'modified',
      content: Array.from({ length: 40 }, (_, i) => `const line_${i + 1} = ${i + 1};`).join('\n'),
    }

    const capturedBodies: Array<Record<string, unknown>> = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      capturedBodies.push(body)
      const messages = (body.messages as Array<{ role: string; content: string }>) ?? []
      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
      const hasToolRole = messages.some((m) => m.role === 'tool')

      // Paso 1 en el nodo raíz: decide descomponer en 2 sub-scopes (SOLID y Seguridad)
      if (lastUserMessage.includes('SCOPE ACTUAL: scope_file_src_auth_AuthProcessor.ts')) {
        return createSseToolCallResponse(
          'descomponer_en_subtareas',
          {
            justificacion: 'Separar revisión de arquitectura SOLID y auditoría de seguridad por bloques.',
            subtareas: [
              {
                id_subtarea: 'scope_auth_solid',
                descripcion: 'Analizar acoplamiento y responsabilidad única en AuthProcessor',
                skill_requerida: 'skill_solid',
                lineStart: 1,
                lineEnd: 20,
              },
              {
                id_subtarea: 'scope_auth_security',
                descripcion: 'Revisar validación de credenciales y tokens en AuthProcessor',
                skill_requerida: 'skill_security',
                lineStart: 21,
                lineEnd: 40,
              },
            ],
          },
          'El fichero tiene múltiples responsabilidades; conviene dividir en 2 scopes concurrentes.',
        )
      }

      // Sub-scope 1 (SOLID): Paso 1 elige ejecutar_tarea_atomica
      if (lastUserMessage.includes('SCOPE ACTUAL: scope_auth_solid')) {
        return createSseToolCallResponse('ejecutar_tarea_atomica', {
          skill_a_usar: 'skill_solid',
          argumentos: {
            foco: 'Acoplamiento directo con proveedor de persistencia',
            lineStart: 1,
            lineEnd: 20,
          },
        })
      }

      // Sub-scope 1 (SOLID): Ejecución de la skill atómica con registrar_hallazgos_atomicos
      if (lastUserMessage.includes('SCOPE ID: scope_auth_solid') && lastUserMessage.includes('TAREA ATÓMICA:')) {
        return createSseToolCallResponse('registrar_hallazgos_atomicos', {
          sumario_ejecutivo: 'Detectado acoplamiento fuerte en la línea 8 que viola DIP.',
          suggestions: [
            {
              id: 'solid-1',
              filePath: 'src/auth/AuthProcessor.ts',
              line: 8,
              severity: 'media',
              category: 'solid',
              message: 'La clase instancia directamente el cliente de base de datos sin inyección de dependencias',
              recommendation: 'Inyectar una interfaz de repositorio a través del constructor',
            },
          ],
        })
      }

      // Sub-scope 2 (Seguridad): Paso 1 elige ejecutar_tarea_atomica incluyendo directamente el hallazgo
      if (lastUserMessage.includes('SCOPE ACTUAL: scope_auth_security')) {
        return createSseToolCallResponse('ejecutar_tarea_atomica', {
          skill_a_usar: 'skill_security',
          argumentos: {
            foco: 'Verificación de firma JWT',
            lineStart: 21,
            lineEnd: 40,
            sumario_ejecutivo: 'Falta verificación de expiración del token en la línea 29.',
            suggestions: [
              {
                id: 'sec-1',
                filePath: 'src/auth/AuthProcessor.ts',
                line: 29,
                severity: 'alta',
                category: 'security',
                message: 'El token JWT se decodifica sin verificar su firma criptográfica ni expiración',
                recommendation: 'Utilizar verify() con clave pública y validar el claim exp antes de autenticar',
              },
            ],
          },
        })
      }

      // Paso 3 (Reducción en el padre): Primero solicita consultar_detalle_scope sobre scope_auth_security
      if (lastUserMessage.includes('Consolida los engramas resultantes') && !hasToolRole) {
        return createSseToolCallResponse('consultar_detalle_scope', {
          id_scope: 'scope_auth_security',
          pregunta: '¿Qué línea exacta presenta la vulnerabilidad JWT?',
        })
      }

      // Paso 3 (Segundo turno tras recibir el detalle desde engram-ts): Consolida ambos hallazgos
      if (hasToolRole) {
        return createSseToolCallResponse('consolidar_resultados_scope', {
          sumario_ejecutivo: 'Revisión consolidada: 1 problema de diseño SOLID (L8) y 1 vulnerabilidad crítica JWT (L29).',
          suggestions: [
            {
              id: 'solid-1',
              filePath: 'src/auth/AuthProcessor.ts',
              line: 8,
              severity: 'media',
              category: 'solid',
              message: 'La clase instancia directamente el cliente de base de datos sin inyección de dependencias',
              recommendation: 'Inyectar una interfaz de repositorio a través del constructor',
            },
            {
              id: 'sec-1',
              filePath: 'src/auth/AuthProcessor.ts',
              line: 29,
              severity: 'alta',
              category: 'security',
              message: 'El token JWT se decodifica sin verificar su firma criptográfica ni expiración',
              recommendation: 'Utilizar verify() con clave pública y validar el claim exp antes de autenticar',
            },
          ],
        })
      }

      throw new Error(`Petición inesperada al SLM mock: ${lastUserMessage.slice(0, 120)}`)
    }) as typeof fetch

    try {
      const streamedIds: string[] = []
      const thoughts: string[] = []
      const result = await analyzeFileWithSlm(
        sampleFile,
        (s) => {
          streamedIds.push(s.id)
        },
        (t) => {
          thoughts.push(t)
        },
        undefined,
        {
          reviewId: 202,
          project: 'review-202',
          engram,
          maxDepth: 3,
          maxConcurrency: 2,
        },
      )

      assert.equal(result.length, 2, 'Debe consolidar las 2 sugerencias de los sub-scopes hijos')
      assert.equal(result[0].line, 8)
      assert.equal(result[0].category, CommentCategory.SOLID)
      assert.equal(result[1].line, 29)
      assert.equal(result[1].category, CommentCategory.SECURITY)
      assert.ok(thoughts.length > 0, 'Debe emitir razonamiento en streaming')

      // Verificar que TODAS las llamadas al SLM usaron exclusivamente Function Calling nativo (`tools`) y `tool_choice` tipo string
      for (const reqBody of capturedBodies) {
        assert.ok(Array.isArray(reqBody.tools) && reqBody.tools.length > 0, 'Cada llamada debe incluir tools nativas')
        assert.equal(typeof reqBody.tool_choice, 'string', 'tool_choice debe ser siempre un string (none | auto | required)')
        assert.ok(
          ['none', 'auto', 'required'].includes(String(reqBody.tool_choice)),
          `tool_choice inválido: ${String(reqBody.tool_choice)}`,
        )
        assert.equal(reqBody.response_format, undefined, 'No debe mezclar response_format con Function Calling nativo')
      }

      // Verificar que los scopes intermedios y la síntesis quedaron persistidos en engram-ts
      const storedMemories = await engram.search({ query: '', project: 'review-202', limit: 50 })
      const memoryTypes = storedMemories.map((m) => m.header.type)
      assert.ok(memoryTypes.includes('scope-plan'), 'El plan de descomposición debe guardarse en engram-ts')
      assert.ok(memoryTypes.includes('scope-atomic-result'), 'Los resultados atómicos deben guardarse en engram-ts')
      assert.ok(memoryTypes.includes('scope-synthesis'), 'La síntesis agregada debe guardarse en engram-ts')
    } finally {
      globalThis.fetch = originalFetch
    }
  }

  // Test 3: Reutilización automática desde memoria engram-ts cuando una tarea ya fue realizada en otro sub-scope
  {
    console.log('Test 3: Recuperación desde memoria engram-ts sin generar llamadas adicionales si el sub-scope ya fue realizado')
    const engram = new Engram({ store: new InMemoryEngramStore() })
    const sampleFile: StoredReviewFile = {
      reviewId: 303,
      path: 'src/utils/CryptoHelper.ts',
      status: 'modified',
      content: 'export function hashPassword(pw: string) {\n  return crypto.createHash("md5").update(pw).digest("hex");\n}',
    }

    const rootStorage = new ReviewScopeStorage({
      engram,
      project: 'review-303',
      filePath: sampleFile.path,
      scopeId: 'scope_root_crypto',
      depth: 0,
    })

    let slmCallCount = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      slmCallCount += 1
      return createSseToolCallResponse('ejecutar_tarea_atomica', {
        skill_a_usar: 'skill_security',
        argumentos: {
          foco: 'Algoritmo de hash débil MD5',
          lineStart: 1,
          lineEnd: 3,
          sumario_ejecutivo: 'Uso de MD5 para contraseñas en línea 2.',
          suggestions: [
            {
              id: 'crypto-md5',
              filePath: sampleFile.path,
              line: 2,
              severity: 'alta',
              category: 'security',
              message: 'Uso del algoritmo criptográfico débil MD5 para almacenar contraseñas',
              recommendation: 'Reemplazar MD5 por Argon2id, scrypt o bcrypt con factor de coste adecuado',
            },
          ],
        },
      })
    }) as typeof fetch

    try {
      const taskDef = {
        id_subtarea: 'scope_crypto_hash_check',
        descripcion: 'Verificar algoritmo de hash de contraseñas',
        skill_requerida: 'skill_security' as const,
        lineStart: 1,
        lineEnd: 3,
      }

      // Primera ejecución del sub-scope: llama al SLM y guarda en engram-ts
      const firstRun = await procesarNodoScope(taskDef, rootStorage, {
        file: sampleFile,
        baseInstructions: 'Revisa seguridad',
        maxDepth: 3,
        maxConcurrency: 2,
      })
      assert.equal(slmCallCount, 1)
      assert.equal(firstRun.fromMemoryCache, false)
      assert.equal(firstRun.suggestions.length, 1)

      // Segunda ejecución de la misma tarea en otro sub-scope: debe recuperarse de engram-ts sin llamar al SLM
      const secondRun = await procesarNodoScope(
        {
          ...taskDef,
          id_subtarea: 'scope_duplicate_branch_check',
        },
        rootStorage,
        {
          file: sampleFile,
          baseInstructions: 'Revisa seguridad',
          maxDepth: 3,
          maxConcurrency: 2,
        },
      )
      assert.equal(slmCallCount, 1, 'No debe realizar ninguna llamada adicional al SLM; debe reutilizar la memoria de engram-ts')
      assert.equal(secondRun.fromMemoryCache, true, 'El resultado debe provenir de la caché de memoria de engram-ts')
      assert.equal(secondRun.engram_ref, firstRun.engram_ref)
      assert.equal(secondRun.suggestions.length, 1)
      assert.equal(secondRun.suggestions[0].line, 2)
    } finally {
      globalThis.fetch = originalFetch
    }
  }

  // Test 4: Límite de profundidad máxima (maxDepth) y concurrencia máxima (maxConcurrency)
  {
    console.log('Test 4: Control estricto de profundidad máxima (maxDepth) y concurrencia (maxConcurrency)')
    const toolsAtDepth0 = buildStep1ScopeTools(true, false)
    assert.ok(
      toolsAtDepth0.some((t) => t.function.name === 'descomponer_en_subtareas'),
      'Por debajo de maxDepth debe permitir descomponer_en_subtareas',
    )

    const toolsAtMaxDepth = buildStep1ScopeTools(false, false)
    assert.ok(
      !toolsAtMaxDepth.some((t) => t.function.name === 'descomponer_en_subtareas'),
      'En maxDepth no debe ofrecer descomponer_en_subtareas para evitar recursión infinita',
    )
    assert.equal(toolsAtMaxDepth[0].function.name, 'ejecutar_tarea_atomica')

    // Verificar concurrencia acotada con runWithConcurrency
    let activeWorkers = 0
    let maxObservedConcurrency = 0
    const tasks = [1, 2, 3, 4, 5, 6]
    const results = await runWithConcurrency(tasks, 2, async (item) => {
      activeWorkers += 1
      maxObservedConcurrency = Math.max(maxObservedConcurrency, activeWorkers)
      await new Promise((resolve) => setTimeout(resolve, 15))
      activeWorkers -= 1
      return item * 10
    })

    assert.deepEqual(results, [10, 20, 30, 40, 50, 60])
    assert.ok(maxObservedConcurrency <= 2, `La concurrencia máxima observada (${maxObservedConcurrency}) no debe superar el límite (2)`)
  }

  // Test 5: Prevención de interbloqueo padre-hijo cuando el SLM omite rangos o skills en subtareas y límite global SlmConcurrencyGate
  {
    console.log('Test 5: Prevención de interbloqueo padre-hijo (inFlightMap) y control global de peticiones HTTP con SlmConcurrencyGate')
    const engram = new Engram({ store: new InMemoryEngramStore() })
    const sampleFile: StoredReviewFile = {
      reviewId: 505,
      path: 'src/legacy/OrderController.ts',
      status: 'modified',
      content: Array.from({ length: 15 }, (_, i) => `export const step_${i + 1} = ${i + 1};`).join('\n'),
    }

    let inFlightHttpCalls = 0
    let maxObservedHttpCalls = 0
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      inFlightHttpCalls += 1
      maxObservedHttpCalls = Math.max(maxObservedHttpCalls, inFlightHttpCalls)
      await new Promise((resolve) => setTimeout(resolve, 10))
      try {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        const messages = (body.messages as Array<{ role: string; content: string }>) ?? []
        const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

        // El nodo raíz descompone en 2 subtareas pero el modelo pequeño omite lineStart/lineEnd y usa skill_general en una de ellas
        // (antes esto colisionaba con el sigTag inFlight del padre y dejaba colgada la promesa tras guardar las demás en engram)
        if (lastUserMessage.includes('SCOPE ACTUAL: scope_file_src_legacy_OrderController.ts')) {
          return createSseToolCallResponse('descomponer_en_subtareas', {
            justificacion: 'Dividir revisión general y seguridad sin especificar rangos de línea.',
            subtareas: [
              {
                id_subtarea: 'sub_general_full_file',
                descripcion: 'Analizar estructura general del controlador',
                skill_requerida: 'skill_general',
                // Sin lineStart ni lineEnd -> hereda 1..15 igual que el padre
              },
              {
                id_subtarea: 'sub_security_full_file',
                descripcion: 'Revisar exposición de datos en el controlador',
                skill_requerida: 'skill_security',
              },
            ],
          })
        }

        if (lastUserMessage.includes('SCOPE ACTUAL: sub_general_full_file')) {
          return createSseToolCallResponse('ejecutar_tarea_atomica', {
            skill_a_usar: 'skill_general',
            argumentos: {
              foco: 'Revisión general',
              sumario_ejecutivo: 'Falta tipado explícito en línea 3.',
              suggestions: [
                {
                  id: 'gen-1',
                  filePath: sampleFile.path,
                  line: 3,
                  severity: 'baja',
                  category: 'maintainability',
                  message: 'Constante exportada sin contrato explícito',
                  recommendation: 'Declarar tipo o interfaz del paso de orden',
                },
              ],
            },
          })
        }

        if (lastUserMessage.includes('SCOPE ACTUAL: sub_security_full_file')) {
          return createSseToolCallResponse('ejecutar_tarea_atomica', {
            skill_a_usar: 'skill_security',
            argumentos: {
              foco: 'Seguridad general',
              sumario_ejecutivo: 'Sin hallazgos de seguridad.',
              suggestions: [],
            },
          })
        }

        if (lastUserMessage.includes('Consolida los engramas resultantes')) {
          return createSseToolCallResponse('consolidar_resultados_scope', {
            sumario_ejecutivo: 'Consolidación completada sin bloqueo.',
            suggestions: [
              {
                id: 'gen-1',
                filePath: sampleFile.path,
                line: 3,
                severity: 'baja',
                category: 'maintainability',
                message: 'Constante exportada sin contrato explícito',
                recommendation: 'Declarar tipo o interfaz del paso de orden',
              },
            ],
          })
        }

        throw new Error(`Llamada inesperada en Test 5: ${lastUserMessage.slice(0, 100)}`)
      } finally {
        inFlightHttpCalls -= 1
      }
    }) as typeof fetch

    try {
      const gate = new SlmConcurrencyGate(1)
      const result = await analyzeFileWithSlm(sampleFile, undefined, undefined, undefined, {
        reviewId: 505,
        project: 'review-505',
        engram,
        maxDepth: 3,
        maxConcurrency: 2,
        concurrencyGate: gate,
      })

      assert.equal(result.length, 1, 'Debe finalizar sin interbloqueo padre-hijo y devolver la sugerencia consolidada')
      assert.equal(result[0].line, 3)
      assert.equal(
        maxObservedHttpCalls,
        1,
        `El semáforo SlmConcurrencyGate(1) debe limitar las peticiones HTTP simultáneas a 1 (observado: ${maxObservedHttpCalls})`,
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  }

  console.log('✓ Todas las pruebas de Memoria Engram-ts y Orquestación por Scopes pasaron exitosamente.')
}

void runTests()

