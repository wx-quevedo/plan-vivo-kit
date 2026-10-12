// Capturas del visor con el plan de ejemplo, para docs/capturas/:
//   pnpm capturas
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@playwright/test'
import { AHORA, KIT } from './config'

const DIR = join(KIT, 'docs', 'capturas')

test('capturas del visor con el plan de ejemplo', async ({ page }) => {
  mkdirSync(DIR, { recursive: true })
  await page.clock.setFixedTime(AHORA)
  await page.goto('/')
  await page.locator('.phase-card').first().waitFor()
  await page.waitForTimeout(400)

  await page.screenshot({ path: join(DIR, 'visor-completo.png'), fullPage: true })
  await page.locator('#fases').screenshot({ path: join(DIR, 'fases.png') })
  await page.locator('#linea-de-tiempo').screenshot({ path: join(DIR, 'linea-de-tiempo.png') })
  await page.locator('#mapa').screenshot({ path: join(DIR, 'mapa.png') })

  // Zoom de la fase en curso, con la consola del item P4 abierta.
  await page.getByRole('button', { name: 'Abrir la fase F2 Reservas' }).click()
  await page.locator('.node', { hasText: 'Formulario de reserva' }).click()
  await page.locator('.console').waitFor()
  await page.waitForTimeout(600)
  await page.locator('#fases').screenshot({ path: join(DIR, 'fase-zoom.png') })
})
