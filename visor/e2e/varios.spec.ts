// Un solo visor para varios planes: --plan repetido, selector, una dirección por plan, recarga por plan, y el mismo
// comando corrido otra vez con el visor abierto suma el plan en lugar de levantar otro servidor.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { AHORA, KIT, PUERTO_KIT } from './config'
import { borrarCarpeta, detener, entornoLimpio, esperarServidor } from './procesos'

const URL_VISOR = `http://localhost:${PUERTO_KIT}`

function planDe(titulo: string) {
  return {
    schema_version: 1,
    project: titulo.toLowerCase().replace(/\s+/g, '-'),
    title: titulo,
    updated_at: '2026-10-09T15:00:00-05:00',
    phases: [{ id: 'F1', name: 'Base', items: [{ id: 'P1', type: 'prompt', title: 'x', status: 'pending', estimate_min: [30, 60] }] }],
  }
}

function proyecto(raiz: string, nombre: string, titulo: string): string {
  mkdirSync(join(raiz, nombre))
  const ruta = join(raiz, nombre, 'plan.json')
  writeFileSync(ruta, JSON.stringify(planDe(titulo), null, 2))
  return ruta
}

// pnpm --dir <kit> visor -- <argumentos>, desde la carpeta indicada.
function comandoVisor(args: string[]): string[] {
  return ['--dir', `"${KIT}"`, 'visor', '--', ...args.map((a) => `"${a}"`)]
}

// El mismo comando, con el visor ya abierto: debe terminar solo (código 0), sin levantar otro servidor.
function sumar(cwd: string, ruta: string): { codigo: number | null; salida: string } {
  const r = spawnSync('pnpm', ['--silent', ...comandoVisor(['--plan', ruta, '--puerto', String(PUERTO_KIT)])], {
    cwd,
    env: entornoLimpio(),
    shell: true,
    encoding: 'utf8',
    timeout: 30_000,
  })
  return { codigo: r.status, salida: `${r.stdout}${r.stderr}` }
}

test('un solo visor sirve varios planes, y el mismo comando con el visor abierto suma el plan', async ({ page }) => {
  test.setTimeout(120_000)
  const raiz = mkdtempSync(join(tmpdir(), 'plan-vivo-varios-'))
  const uno = proyecto(raiz, 'proyecto-uno', 'Proyecto uno')
  const dos = proyecto(raiz, 'proyecto-dos', 'Proyecto dos')
  const tres = proyecto(raiz, 'proyecto-tres', 'Proyecto tres')
  let visor: ChildProcess | null = null
  try {
    let salida = ''
    visor = spawn('pnpm', comandoVisor(['--plan', uno, '--plan', dos, '--puerto', String(PUERTO_KIT)]), { cwd: raiz, env: entornoLimpio(), shell: true })
    visor.stdout?.on('data', (dato) => (salida += String(dato)))
    visor.stderr?.on('data', (dato) => (salida += String(dato)))
    await esperarServidor(`${URL_VISOR}/plan.json`, visor, () => salida)
    // El visor imprime sus planes un instante después de empezar a responder.
    await expect.poll(() => salida).toContain(`Plan: ${dos}\n  ${URL_VISOR}/?plan=proyecto-dos`)
    expect(salida).toContain(`Plan: ${uno}\n  ${URL_VISOR}/`)

    // La raíz muestra el primero; el selector lleva a los demás.
    await page.clock.setFixedTime(AHORA)
    await page.goto(`${URL_VISOR}/`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proyecto uno')
    const selector = page.getByTestId('selector-planes')
    await expect(selector.getByRole('link')).toHaveText(['proyecto-uno', 'proyecto-dos'])
    await expect(selector.getByRole('link', { name: 'proyecto-uno' })).toHaveAttribute('aria-current', 'page')
    await selector.getByRole('link', { name: 'proyecto-dos' }).click()
    await expect(page).toHaveURL(`${URL_VISOR}/?plan=proyecto-dos`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proyecto dos')
    await expect(page.getByTestId('ruta-plan')).toContainText(dos)

    // Guardar este plan lo recarga; guardar otro no cambia lo que se ve aquí.
    writeFileSync(dos, JSON.stringify(planDe('Proyecto dos, editado'), null, 2))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proyecto dos, editado')
    writeFileSync(uno, JSON.stringify(planDe('Proyecto uno, editado'), null, 2))
    const otraPestana = await page.context().newPage()
    await otraPestana.goto(`${URL_VISOR}/`)
    await expect(otraPestana.getByRole('heading', { level: 1 })).toHaveText('Proyecto uno, editado')

    // El mismo comando, con el visor abierto: suma el plan y termina; no levanta otro servidor.
    const segunda = sumar(raiz, tres)
    expect(segunda.codigo).toBe(0)
    expect(segunda.salida).toContain(`El visor del plan vivo ya está abierto en ${URL_VISOR}: no se levanta otro.`)
    expect(segunda.salida).toContain(`Plan agregado: ${tres}\n  ${URL_VISOR}/?plan=proyecto-tres`)
    // Las pestañas abiertas ven el plan nuevo en el selector sin recargar.
    await expect(page.getByTestId('selector-planes').getByRole('link')).toHaveText(['proyecto-uno', 'proyecto-dos', 'proyecto-tres'])
    await page.getByTestId('selector-planes').getByRole('link', { name: 'proyecto-tres' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proyecto tres')

    // Correrlo otra vez con el mismo plan no lo duplica.
    const tercera = sumar(raiz, tres)
    expect(tercera.codigo).toBe(0)
    expect(tercera.salida).toContain(`El plan ya estaba: ${tres}`)
    const lista = (await (await fetch(`${URL_VISOR}/__plan-vivo/planes`)).json()) as { planes: { id: string }[] }
    expect(lista.planes.map((p) => p.id)).toEqual(['proyecto-uno', 'proyecto-dos', 'proyecto-tres'])

    // Un id que el visor no tiene: lo dice y deja el selector para elegir.
    await page.goto(`${URL_VISOR}/?plan=no-esta`)
    await expect(page.getByTestId('error-carga')).toContainText('Este visor no tiene ningún plan «no-esta»')
    await expect(page.getByTestId('selector-planes').getByRole('link')).toHaveCount(3)
  } finally {
    if (visor) detener(visor)
    borrarCarpeta(raiz)
  }
})

test('agregar un plan exige la cabecera propia y una ruta absoluta a un .json que existe', async () => {
  test.setTimeout(120_000)
  const raiz = mkdtempSync(join(tmpdir(), 'plan-vivo-varios-'))
  const uno = proyecto(raiz, 'proyecto-uno', 'Proyecto uno')
  let visor: ChildProcess | null = null
  try {
    let salida = ''
    visor = spawn('pnpm', comandoVisor(['--plan', uno, '--puerto', String(PUERTO_KIT)]), { cwd: raiz, env: entornoLimpio(), shell: true })
    visor.stdout?.on('data', (dato) => (salida += String(dato)))
    visor.stderr?.on('data', (dato) => (salida += String(dato)))
    await esperarServidor(`${URL_VISOR}/plan.json`, visor, () => salida)
    const sumar = (cuerpo: unknown, cabecera = true) =>
      fetch(`${URL_VISOR}/__plan-vivo/planes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cabecera ? { 'x-plan-vivo': '1' } : {}) },
        body: JSON.stringify(cuerpo),
      })
    expect((await sumar({ ruta: uno }, false)).status).toBe(403)
    const relativa = await sumar({ ruta: 'proyecto-uno/plan.json' })
    expect([relativa.status, ((await relativa.json()) as { error: string }).error]).toEqual([400, 'La ruta del plan debe ser absoluta: proyecto-uno/plan.json'])
    const falta = await sumar({ ruta: join(raiz, 'falta.json') })
    expect([falta.status, ((await falta.json()) as { error: string }).error]).toEqual([400, `No existe el plan: ${join(raiz, 'falta.json')}`])
    const lista = (await (await fetch(`${URL_VISOR}/__plan-vivo/planes`)).json()) as { planes: { id: string }[] }
    expect(lista.planes).toHaveLength(1)
  } finally {
    if (visor) detener(visor)
    borrarCarpeta(raiz)
  }
})
