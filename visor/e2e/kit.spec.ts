// Sigue los pasos de instalación del README en una carpeta vacía: copia el kit dentro de un proyecto nuevo,
// instala, apunta la configuración a ../plan.json, crea un plan.json y abre el visor.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { expect, test } from '@playwright/test'
import { AHORA, KIT, PUERTO_KIT } from './config'

const EXCLUIR = ['node_modules', '.git', 'test-results', 'playwright-report', 'dist', join('e2e', '.tmp')]

// Entorno limpio: sin las variables PLAN_VIVO_* ni el INIT_CWD de quien corre las pruebas.
function entornoLimpio(): NodeJS.ProcessEnv {
  const entorno = { ...process.env }
  for (const clave of Object.keys(entorno)) if (clave.startsWith('PLAN_VIVO_') || clave === 'INIT_CWD') delete entorno[clave]
  return entorno
}

async function esperarServidor(url: string, proceso: ChildProcess, salida: () => string): Promise<void> {
  const limite = Date.now() + 60_000
  while (Date.now() < limite) {
    if (proceso.exitCode !== null) throw new Error(`pnpm visor terminó antes de tiempo:\n${salida()}`)
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // Todavía no escucha.
    }
    await new Promise((listo) => setTimeout(listo, 300))
  }
  throw new Error(`El visor no respondió en ${url}:\n${salida()}`)
}

function detener(proceso: ChildProcess): void {
  if (proceso.pid === undefined || proceso.exitCode !== null) return
  if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' })
  else proceso.kill('SIGTERM')
}

test('kit copiado a una carpeta vacía: instala, lee el plan.json nuevo del proyecto y abre el visor', async ({ page }) => {
  test.setTimeout(300_000)
  const proyecto = mkdtempSync(join(tmpdir(), 'plan-vivo-proyecto-'))
  expect(readdirSync(proyecto)).toEqual([])
  const kit = join(proyecto, 'plan-vivo')
  let visor: ChildProcess | null = null
  try {
    // Paso 1: copiar el kit dentro del proyecto (sin node_modules ni lo generado por las pruebas).
    cpSync(KIT, kit, {
      recursive: true,
      filter: (origen) => {
        const ruta = relative(KIT, origen)
        return !EXCLUIR.some((parte) => ruta === parte || ruta.startsWith(parte + sep) || ruta.includes(sep + parte + sep) || ruta.endsWith(sep + parte))
      },
    })
    expect(readdirSync(kit)).not.toContain('node_modules')

    // Paso 2: instalar (sin red: el almacén de pnpm de esta máquina ya tiene los paquetes).
    execFileSync('pnpm', ['install', '--offline'], { cwd: kit, env: entornoLimpio(), shell: true, stdio: 'pipe' })

    // Paso 3: apuntar el visor al plan del proyecto y crear plan.json (lo que haría el agente al empezar).
    const config = JSON.parse(readFileSync(join(kit, 'plan-vivo.config.json'), 'utf8'))
    writeFileSync(join(kit, 'plan-vivo.config.json'), JSON.stringify({ ...config, plan: '../plan.json', puerto: PUERTO_KIT }, null, 2))
    const plan = {
      $schema: 'plan-vivo/schema/plan.schema.json',
      schema: 1,
      project: 'proyecto-e2e',
      title: 'Proyecto nuevo de prueba',
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
    writeFileSync(join(proyecto, 'plan.json'), JSON.stringify(plan, null, 2))

    // Paso 4: pnpm visor.
    let salida = ''
    visor = spawn('pnpm', ['visor'], { cwd: kit, env: entornoLimpio(), shell: true })
    visor.stdout?.on('data', (dato) => (salida += String(dato)))
    visor.stderr?.on('data', (dato) => (salida += String(dato)))
    await esperarServidor(`http://localhost:${PUERTO_KIT}/plan.json`, visor, () => salida)
    expect(salida).toContain(join(proyecto, 'plan.json'))

    await page.clock.setFixedTime(AHORA)
    await page.goto(`http://localhost:${PUERTO_KIT}/`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proyecto nuevo de prueba')
    await expect(page.getByTestId('ruta-plan')).toContainText(join(proyecto, 'plan.json'))
    await expect(page.locator('.phase-card')).toHaveCount(2)
    await expect(page.locator('.phase-card').first()).toContainText('En curso · 0 de 1')
    await expect(page.locator('.phase-card').first().getByTestId('fase-real')).toHaveText('Real 25 min')
    await expect(page.locator('#linea-de-tiempo .tl-row')).toHaveCount(2)
    await expect(page.locator('#mapa .metro-here-pill')).toHaveText('Estás aquí')
  } finally {
    if (visor) detener(visor)
    rmSync(proyecto, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
  }
})
