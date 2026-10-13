// Uso desde otro proyecto (decisión K1): el kit no se copia. Desde la carpeta de un proyecto que solo tiene su
// plan.json, se levanta el visor del kit con pnpm --dir <kit> visor -- --plan plan.json (ruta relativa a esa carpeta).
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { AHORA, KIT, PUERTO_KIT } from './config'
import { borrarCarpeta, detener, entornoLimpio, esperarServidor } from './procesos'

const plan = {
  $schema: '../plan-vivo/schema/plan.schema.json',
  schema_version: 1,
  project: 'proyecto-e2e',
  title: 'Proyecto de otro repositorio',
  updated_at: '2026-10-09T15:00:00-05:00',
  phases: [
    {
      id: 'F1',
      name: 'Arranque',
      items: [
        {
          id: 'P1',
          type: 'prompt',
          title: 'Primer prompt',
          status: 'in_progress',
          estimate_min: [30, 60],
          work_log: [{ actor: 'coding_agent', start: '2026-10-09T14:00:00-05:00', end: '2026-10-09T14:25:00-05:00', note: '', commits: [] }],
        },
      ],
    },
    { id: 'F2', name: 'Siguiente', estimate_min: [60, 120], items: [] },
  ],
}

test('plan fuera de la carpeta del kit: pnpm --dir <kit> visor -- --plan plan.json desde la carpeta del proyecto', async ({ page }) => {
  test.setTimeout(120_000)
  const proyecto = mkdtempSync(join(tmpdir(), 'plan-vivo-proyecto-'))
  const ruta = join(proyecto, 'plan.json')
  writeFileSync(ruta, JSON.stringify(plan, null, 2))
  const configDelKit = readFileSync(join(KIT, 'plan-vivo.config.json'), 'utf8')
  let visor: ChildProcess | null = null
  try {
    let salida = ''
    visor = spawn('pnpm', ['--dir', `"${KIT}"`, 'visor', '--', '--plan', 'plan.json', '--puerto', String(PUERTO_KIT)], {
      cwd: proyecto,
      env: entornoLimpio(),
      shell: true,
    })
    visor.stdout?.on('data', (dato) => (salida += String(dato)))
    visor.stderr?.on('data', (dato) => (salida += String(dato)))
    await esperarServidor(`http://localhost:${PUERTO_KIT}/plan.json`, visor, () => salida)
    // El visor imprime sus planes un instante después de empezar a responder.
    await expect.poll(() => salida).toContain(`Plan: ${ruta}`)

    await page.clock.setFixedTime(AHORA)
    await page.goto(`http://localhost:${PUERTO_KIT}/`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proyecto de otro repositorio')
    await expect(page.getByTestId('ruta-plan')).toContainText(ruta)
    await expect(page.locator('.phase-card')).toHaveCount(2)
    await expect(page.locator('.phase-card').first()).toContainText('En curso · 0 de 1')
    await expect(page.locator('.phase-card').first().getByTestId('fase-real')).toHaveText('Real 25 min')
    await expect(page.locator('#linea-de-tiempo .tl-row')).toHaveCount(2)
    await expect(page.locator('#mapa .metro-here-pill')).toHaveText('Estás aquí')

    // Se recarga al guardar el plan del proyecto.
    writeFileSync(ruta, JSON.stringify({ ...plan, title: 'Proyecto de otro repositorio, actualizado' }, null, 2))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proyecto de otro repositorio, actualizado')

    // Nada se escribió en el proyecto ni en la configuración del kit.
    expect(readdirSync(proyecto)).toEqual(['plan.json'])
    expect(readFileSync(join(KIT, 'plan-vivo.config.json'), 'utf8')).toBe(configDelKit)
  } finally {
    if (visor) detener(visor)
    borrarCarpeta(proyecto)
  }
})

test('plan que no existe: el visor no arranca y dice qué ruta falta', () => {
  const proyecto = mkdtempSync(join(tmpdir(), 'plan-vivo-proyecto-'))
  try {
    let salida = ''
    try {
      execFileSync('pnpm', ['--silent', '--dir', `"${KIT}"`, 'visor', '--', '--plan', 'no-existe.json', '--puerto', String(PUERTO_KIT)], {
        cwd: proyecto,
        env: entornoLimpio(),
        shell: true,
        encoding: 'utf8',
        stdio: 'pipe',
        // Si el visor arrancara a pesar del plan inexistente, no quedaría esperando para siempre.
        timeout: 30_000,
      })
    } catch (error) {
      const e = error as { stdout: string; stderr: string; status: number }
      salida = `${e.stdout}${e.stderr}`
      expect(e.status).toBe(1)
    }
    expect(salida).toContain(`No existe el plan: ${join(proyecto, 'no-existe.json')} (indicada con --plan)`)

    // También el segundo de varios --plan.
    writeFileSync(join(proyecto, 'plan.json'), '{}')
    let segunda = ''
    try {
      execFileSync('pnpm', ['--silent', '--dir', `"${KIT}"`, 'visor', '--', '--plan', 'plan.json', '--plan', 'otro.json', '--puerto', String(PUERTO_KIT)], {
        cwd: proyecto,
        env: entornoLimpio(),
        shell: true,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30_000,
      })
    } catch (error) {
      const e = error as { stdout: string; stderr: string }
      segunda = `${e.stdout}${e.stderr}`
    }
    expect(segunda).toContain(`No existe el plan: ${join(proyecto, 'otro.json')} (indicada con --plan)`)
  } finally {
    borrarCarpeta(proyecto)
  }
})
