import assert from 'node:assert/strict'
import { es } from '../src/i18n/locales/es'
import { en } from '../src/i18n/locales/en'
import {
  getLanguage,
  setLanguage,
  toggleLanguage,
  onLanguageChange,
  t,
  tStatus,
  tSeverity,
  tCategory,
  tDecision,
  tAuthor,
  formatRelativeTime,
} from '../src/i18n/index'

console.log('--- Iniciando pruebas de Internacionalización (i18n) ---')

// Helper para comparar recursivamente las claves de dos objetos
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...extractKeys(value as Record<string, unknown>, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys.sort()
}

// Test 1: Paridad de claves entre diccionarios ES y EN
{
  const esKeys = extractKeys(es as unknown as Record<string, unknown>)
  const enKeys = extractKeys(en as unknown as Record<string, unknown>)

  assert.equal(esKeys.length, enKeys.length, `Cantidad de claves difiere: ES=${esKeys.length}, EN=${enKeys.length}`)
  assert.deepEqual(esKeys, enKeys, 'Las claves entre ES y EN deben coincidir exactamente')

  // Verificar que ninguna clave tenga valor vacío
  for (const key of esKeys) {
    const esVal = t(key)
    assert.ok(esVal.length > 0, `Valor vacío en clave ES: ${key}`)
  }

  console.log(`✓ Caso 1 superado: Paridad 1:1 verificada en ${esKeys.length} claves sin valores vacíos`)
}

// Test 2: Traducción con y sin interpolación de parámetros
{
  setLanguage('es')
  assert.equal(t('common.cancel'), 'Cancelar')
  assert.equal(t('reviews.heading.registeredCount', { count: 5 }), '5 procesos registrados')
  assert.equal(t('dialogs.connect.statusConnecting', { provider: 'GitHub' }), 'Conectando con GitHub...')

  setLanguage('en')
  assert.equal(t('common.cancel'), 'Cancel')
  assert.equal(t('reviews.heading.registeredCount', { count: 5 }), '5 registered processes')
  assert.equal(t('dialogs.connect.statusConnecting', { provider: 'GitHub' }), 'Connecting to GitHub...')

  console.log('✓ Caso 2 superado: Traducción básica e interpolación de variables en ambos idiomas')
}

// Test 3: Conmutación y reactividad (listeners)
{
  setLanguage('es')
  assert.equal(getLanguage(), 'es')

  let notifiedLang = ''
  const unsubscribe = onLanguageChange((newLang) => {
    notifiedLang = newLang
  })

  const switched = toggleLanguage()
  assert.equal(switched, 'en')
  assert.equal(getLanguage(), 'en')
  assert.equal(notifiedLang, 'en')

  toggleLanguage()
  assert.equal(getLanguage(), 'es')
  assert.equal(notifiedLang, 'es')

  unsubscribe()
  toggleLanguage()
  assert.equal(notifiedLang, 'es', 'No debe recibir notificaciones después de desuscribirse')

  console.log('✓ Caso 3 superado: toggleLanguage y listeners reactivos funcionan correctamente')
}

// Test 4: Helpers de dominio en ES y EN
{
  setLanguage('es')
  assert.equal(tStatus('En curso'), 'En curso')
  assert.equal(tStatus('En preparacion'), 'En preparación')
  assert.equal(tStatus('Cerrada'), 'Cerrada')
  assert.equal(tStatus('Aprobada'), 'Aprobada')

  assert.equal(tSeverity('alta'), 'Alta')
  assert.equal(tSeverity('baja'), 'Baja')
  assert.equal(tCategory('security'), 'Seguridad')
  assert.equal(tDecision('bloqueante'), 'Bloqueante')
  assert.equal(tAuthor('SLM local'), 'SLM local')

  setLanguage('en')
  assert.equal(tStatus('En curso'), 'In progress')
  assert.equal(tStatus('En preparacion'), 'In preparation')
  assert.equal(tStatus('Cerrada'), 'Closed')
  assert.equal(tStatus('Aprobada'), 'Approved')

  assert.equal(tSeverity('alta'), 'High')
  assert.equal(tSeverity('baja'), 'Low')
  assert.equal(tCategory('security'), 'Security')
  assert.equal(tDecision('bloqueante'), 'Blocking')
  assert.equal(tAuthor('SLM local'), 'Local SLM')

  console.log('✓ Caso 4 superado: Helpers de dominio tStatus, tSeverity, tCategory, tDecision, tAuthor')
}

// Test 5: Fallback seguro para claves desconocidas
{
  setLanguage('es')
  const unknownKey = 'non.existent.key'
  assert.equal(t(unknownKey), unknownKey)

  console.log('✓ Caso 5 superado: Fallback seguro para claves no existentes')
}

// Test 6: Formato de tiempo relativo amigable (formatRelativeTime)
{
  setLanguage('es')
  assert.equal(formatRelativeTime('Ahora'), 'Ahora')
  assert.equal(formatRelativeTime(new Date()), 'Ahora')
  assert.equal(formatRelativeTime(Date.now() - 5 * 60 * 1000), 'Hace 5 minutos')
  assert.equal(formatRelativeTime(Date.now() - 2 * 3600 * 1000), 'Hace 2 horas')

  setLanguage('en')
  assert.equal(formatRelativeTime('Ahora'), 'Just now')
  assert.equal(formatRelativeTime(new Date()), 'Just now')
  assert.equal(formatRelativeTime(Date.now() - 5 * 60 * 1000), '5 minutes ago')
  assert.equal(formatRelativeTime(Date.now() - 2 * 3600 * 1000), '2 hours ago')

  console.log('✓ Caso 6 superado: formatRelativeTime en español e inglés con soporte para valores legados "Ahora"')
}

console.log('=============================================')
console.log('  ¡TODAS LAS PRUEBAS DE I18N HAN PASADO!  ')
console.log('=============================================')
