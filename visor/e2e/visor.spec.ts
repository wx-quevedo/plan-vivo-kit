import { copyFileSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { AHORA, EJEMPLO, PLAN_E2E } from './config'

async function abrir(page: Page) {
  await page.clock.setFixedTime(AHORA)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda de citas' })).toBeVisible()
}

const tarjeta = (page: Page, id: string) => page.locator('.phase-card').filter({ has: page.locator('.phase-card-id', { hasText: new RegExp(`^${id}$`) }) })

test.afterEach(() => copyFileSync(EJEMPLO, PLAN_E2E))

test('fases: estado derivado, avance, estimado y tiempo real de cada fase', async ({ page }) => {
  await abrir(page)
  await expect(page.getByTestId('ruta-plan')).toContainText('plan.json')
  await expect(page.locator('.top-sub')).toContainText('Hora de Guayaquil')
  await expect(page.locator('.phase-card')).toHaveCount(3)
  await expect(tarjeta(page, 'F1')).toContainText('Terminado · 4 de 4')
  await expect(tarjeta(page, 'F2')).toContainText('En curso · 1 de 4')
  await expect(tarjeta(page, 'F3')).toContainText('Pendiente · 0 de 2')
  // F1: unión de los tramos de P1 (52 min), P2 (99 min), U1 (21 min) y G1 (14 min).
  await expect(tarjeta(page, 'F1').getByTestId('fase-real')).toHaveText('Real 3 h 6 min')
  await expect(tarjeta(page, 'F3').getByTestId('fase-real')).toHaveCount(0)
  await expect(tarjeta(page, 'F3')).toContainText('Estimado 3 h – 5 h')
})

test('zoom de una fase y consola del item: tramos por actor, pausas y commits', async ({ page }) => {
  await abrir(page)
  await page.getByRole('button', { name: 'Abrir la fase F2 Reservas' }).click()
  await expect(page.locator('.zoom-title')).toContainText('Reservas')
  await expect(page.locator('.chain .node')).toHaveCount(4)
  await expect(page.locator('.node--gate')).toContainText('Puerta')
  await page.locator('.node', { hasText: 'Formulario de reserva' }).click()
  const consola = page.locator('.console')
  await expect(consola).toContainText('$ plan show P4')
  await expect(consola).toContainText('Humano')
  await expect(consola.locator('.console-worklog li')).toHaveCount(3)
  await expect(consola).toContainText('b3e8d21')
  await page.getByRole('button', { name: 'Fases' }).click()
  await expect(page.locator('.phase-card')).toHaveCount(3)

  await page.getByRole('button', { name: 'Abrir la fase F1 Base del proyecto' }).click()
  await page.locator('.node', { hasText: 'Migraciones rotas en Windows' }).click()
  await expect(page.locator('.console')).toContainText('Imprevisto')
})

test('línea de tiempo: una fila por fase, marca de ahora, proyección y apertura de la fase', async ({ page }) => {
  await abrir(page)
  const linea = page.locator('#linea-de-tiempo')
  await expect(linea.locator('.tl-row')).toHaveCount(3)
  await expect(linea.locator('.tl-now')).toContainText('ahora')
  await expect(linea.locator('.tl-projected')).toHaveCount(2)
  await expect(linea.locator('.tl-actor--human').first()).toBeAttached()
  await expect(linea.locator('.timeline-footer')).toContainText('Faltan')
  await expect(linea.locator('.timeline-factor')).toContainText('según 4 items terminados')
  await linea.getByRole('button', { name: 'Solo lo trabajado' }).click()
  await expect(linea.getByRole('button', { name: 'Solo lo trabajado' })).toHaveAttribute('aria-pressed', 'true')
  await linea.getByRole('button', { name: 'Ver la fase F3 Avisos y cierre' }).click()
  await expect(page.locator('.zoom-title')).toContainText('Avisos y cierre')
})

test('mapa: "Estás aquí" en la fase en curso y estaciones que abren la fase', async ({ page }) => {
  await abrir(page)
  const mapa = page.locator('#mapa')
  await expect(mapa.locator('.metro-stop')).toHaveCount(3)
  await expect(mapa.locator('.metro-here--active')).toHaveCount(1)
  await expect(mapa.locator('.metro-stop').nth(1).locator('.metro-here-pill')).toHaveText('Estás aquí')
  await mapa.getByRole('button', { name: 'Ir a la fase F1 Base del proyecto' }).click()
  await expect(page.locator('.zoom-title')).toContainText('Base del proyecto')
})

test('idioma: cambia a inglés y lo recuerda al recargar', async ({ page }) => {
  await abrir(page)
  await page.getByRole('button', { name: 'EN' }).click()
  await expect(page.getByRole('heading', { name: 'Phases' })).toBeVisible()
  await expect(tarjeta(page, 'F2')).toContainText('In progress · 1 of 4')
  await expect(tarjeta(page, 'F1').getByTestId('fase-real')).toHaveText('Actual 3 h 6 min')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('recarga en vivo: al guardar plan.json el visor se actualiza sin recargar la página', async ({ page }) => {
  await abrir(page)
  const plan = JSON.parse(readFileSync(EJEMPLO, 'utf8'))
  plan.title = 'Agenda de citas (editado)'
  plan.phases[2].items[0].status = 'in_progress'
  writeFileSync(PLAN_E2E, JSON.stringify(plan, null, 2))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agenda de citas (editado)')
  await expect(tarjeta(page, 'F3')).toContainText('En curso · 0 de 2')

  // Un archivo a medio guardar (JSON roto) muestra el error y no deja la página en blanco.
  writeFileSync(PLAN_E2E, '{ "schema_version": 1, ')
  await expect(page.getByTestId('error-carga')).toContainText('plan.json no es JSON válido')

  // Un plan que no cumple el esquema lista los problemas con su ubicación.
  plan.phases[0].items[0].status = 'terminado'
  writeFileSync(PLAN_E2E, JSON.stringify(plan, null, 2))
  await expect(page.getByRole('alert')).toContainText('plan.json no cumple el esquema')
  await expect(page.getByRole('alert')).toContainText('Estado no válido "terminado" en phases[0].items[0].status (F1 · P1)')

  copyFileSync(EJEMPLO, PLAN_E2E)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agenda de citas')
})

test('sin plan.json: lo dice con la ruta, y lo muestra en cuanto aparece', async ({ page }) => {
  await abrir(page)
  renameSync(PLAN_E2E, `${PLAN_E2E}.aparte`)
  try {
    await page.reload()
    await expect(page.getByTestId('error-carga')).toContainText('No encontré plan.json')
    await expect(page.getByTestId('error-carga')).toContainText('.tmp')
  } finally {
    renameSync(`${PLAN_E2E}.aparte`, PLAN_E2E)
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agenda de citas')
})
