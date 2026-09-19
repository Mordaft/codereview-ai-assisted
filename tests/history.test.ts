import assert from 'node:assert/strict'
import {
  getWeeksCountForMonths,
  getRequiredHeatmapWidth,
  getOptimalMonthsCount,
  generateHeatmapSvg,
} from '../src/screens/history'
import type { Review } from '../src/review-db'

console.log('--- Iniciando pruebas de Historial y Heatmap Responsivo ---')

const refDate = new Date('2026-09-19T12:00:00Z')

// Test 1: Cálculo de semanas y anchos requeridos para cada rango de meses (4 a 10)
{
  console.log('Test 1: Cálculo de semanas y anchos para 4 a 10 meses')
  for (let m = 4; m <= 10; m++) {
    const weeks = getWeeksCountForMonths(m, refDate)
    const width = getRequiredHeatmapWidth(m, refDate)
    assert.ok(weeks >= 16 && weeks <= 46, `Semanas para ${m} meses fuera de rango esperado: ${weeks}`)
    assert.equal(width, 30 + weeks * 13, `Ancho requerido inconsistente con fórmula para ${m} meses`)
  }
}

// Test 2: Comportamiento de getOptimalMonthsCount según el ancho disponible
{
  console.log('Test 2: getOptimalMonthsCount con límites y anchos variables')
  const width10 = getRequiredHeatmapWidth(10, refDate)
  const width7 = getRequiredHeatmapWidth(7, refDate)
  const width4 = getRequiredHeatmapWidth(4, refDate)

  // Gran pantalla: debe dar 10 meses
  assert.equal(getOptimalMonthsCount(width10 + 50, refDate), 10)
  assert.equal(getOptimalMonthsCount(width10, refDate), 10)

  // Justo por debajo de 10 meses: debe reducir
  assert.ok(getOptimalMonthsCount(width10 - 1, refDate) < 10)

  // En el rango de 7 meses
  assert.equal(getOptimalMonthsCount(width7, refDate), 7)
  assert.equal(getOptimalMonthsCount(width7 + 10, refDate), 7)

  // En el rango de 4 meses
  assert.equal(getOptimalMonthsCount(width4, refDate), 4)

  // Pantallas muy estrechas: nunca debe bajar de 4 meses
  assert.equal(getOptimalMonthsCount(200, refDate), 4)
  assert.equal(getOptimalMonthsCount(50, refDate), 4)
  assert.equal(getOptimalMonthsCount(0, refDate), 4)
}

// Test 3: Generación de SVG de Heatmap para diferentes rangos
{
  console.log('Test 3: generateHeatmapSvg')
  const sampleReviews: Review[] = [
    {
      id: 1,
      title: 'PR 1',
      repository: 'org/repo',
      provider: 'github',
      status: 'completed',
      createdAt: '2026-09-15T10:00:00Z',
      comments: 3,
      processingTimeMs: 12000,
      model: 'llama3.2',
    } as Review,
  ]

  for (const months of [10, 8, 7, 5, 4]) {
    const svg = generateHeatmapSvg(sampleReviews, months)
    assert.ok(svg.includes('<svg class="heatmap-svg"'), `SVG no contiene tag de apertura para ${months} meses`)
    assert.ok(svg.includes('heatmap-cell'), `SVG no contiene celdas para ${months} meses`)
    assert.ok(!svg.includes('NaN'), `SVG contiene NaN para ${months} meses`)
    assert.ok(!svg.includes('undefined'), `SVG contiene undefined para ${months} meses`)
  }
}

console.log('✓ Todas las pruebas de Historial y Heatmap Responsivo pasaron exitosamente.')
