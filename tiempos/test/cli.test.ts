// Los comandos corridos desde la carpeta de un proyecto, como lo haría un agente de otro repositorio:
// pnpm --dir <kit> <comando> -- <argumentos>. Nada se escribe en el kit.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RAIZ_KIT } from '../../configuracion.ts'

const dir = () => mkdtempSync(join(tmpdir(), 'cli-'))

// Entorno limpio: sin las variables PLAN_VIVO_* ni el INIT_CWD de quien corre las pruebas.
function entornoLimpio(): NodeJS.ProcessEnv {
  const entorno = { ...process.env }
  for (const clave of Object.keys(entorno)) if (clave.startsWith('PLAN_VIVO_') || clave === 'INIT_CWD') delete entorno[clave]
  return entorno
}

function correr(cwd: string, comando: string, args: string[]): { codigo: number; salida: string } {
  const comillas = (a: string) => `"${a}"`
  const r = spawnSync(`pnpm --silent --dir ${comillas(RAIZ_KIT)} ${comando} -- ${args.map(comillas).join(' ')}`, {
    cwd,
    env: entornoLimpio(),
    shell: true,
    encoding: 'utf8',
  })
  return { codigo: r.status ?? -1, salida: `${r.stdout}${r.stderr}` }
}

const plan = {
  schema_version: 1,
  project: 'prueba',
  title: 'Prueba',
  updated_at: '2026-10-11T10:00:00-05:00',
  phases: [{ id: 'F1', name: 'Base', items: [{ id: 'P1', type: 'prompt', title: 'x', status: 'in_progress' }, { id: 'P2', type: 'prompt', title: 'y', status: 'pending' }] }],
}

const Z = (hm: string) => `2026-10-11T${hm}:00.000Z`
const humano = (hm: string, texto: string) => ({ type: 'user', timestamp: Z(hm), origin: { kind: 'human' }, message: { content: texto } })
const agente = (hm: string) => ({ type: 'assistant', timestamp: Z(hm), message: { content: [{ type: 'text', text: 'relleno' }] } })

function sesiones(registros: object[]): string {
  const carpeta = dir()
  writeFileSync(join(carpeta, 'sesion.jsonl'), registros.map((r) => JSON.stringify(r)).join('\n') + '\n')
  return carpeta
}

function proyecto(): string {
  const raiz = dir()
  writeFileSync(join(raiz, 'plan.json'), JSON.stringify(plan, null, 2))
  spawnSync('git', ['init', '-q'], { cwd: raiz })
  return raiz
}

describe('desde la carpeta de otro proyecto', { timeout: 60_000 }, () => {
  it('validar acepta --plan relativo a la carpeta desde donde se llamó', () => {
    const raiz = proyecto()
    const r = correr(raiz, 'validar', ['--plan', 'plan.json'])
    expect(r.salida).toContain(`plan.json válido: ${join(raiz, 'plan.json')}`)
    expect(r.codigo).toBe(0)
  })

  it('validar con un plan que no existe: mensaje claro y código 1', () => {
    const raiz = dir()
    const r = correr(raiz, 'validar', ['--plan', join(raiz, 'falta.json')])
    expect(r.salida).toContain(`No existe el plan: ${join(raiz, 'falta.json')} (indicada con --plan)`)
    expect(r.codigo).toBe(1)
  })

  it('tiempos lee varias carpetas de sesiones (--sesiones repetido) y no escribe nada sin --aplicar', () => {
    const raiz = proyecto()
    const antes = sesiones([humano('10:00', 'F1 · P1: primera parte'), agente('10:20')])
    const despues = sesiones([humano('11:00', 'F1 · P2: segunda parte'), agente('11:30')])
    const r = correr(raiz, 'tiempos', ['--plan', 'plan.json', '--sesiones', antes, '--sesiones', despues])
    expect(r.salida).toContain('Sesiones leídas: 2')
    expect(r.salida).toContain(`carpetas: ${antes}; ${despues}`)
    expect(r.salida).toMatch(/P1\s+\| coding_agent \|\s+\| 05:00:00–05:20:00 \| solo propuesto/)
    expect(r.salida).toMatch(/P2\s+\| coding_agent \|\s+\| 06:00:00–06:30:00 \| solo propuesto/)
    expect(r.codigo).toBe(0)
    expect(JSON.parse(readFileSync(join(raiz, 'plan.json'), 'utf8'))).toEqual(plan)
  })

  it('tiempos usa --asignaciones aunque el archivo esté fuera de la carpeta del plan', () => {
    const raiz = proyecto()
    const carpeta = sesiones([humano('10:00', 'sin identificador'), agente('10:20')])
    const otra = dir()
    writeFileSync(join(otra, 'asig.json'), JSON.stringify({ mensajes: { [Z('10:00')]: 'P2' } }))
    const r = correr(raiz, 'tiempos', ['--plan', 'plan.json', '--sesiones', carpeta, '--asignaciones', join(otra, 'asig.json')])
    expect(r.salida).toContain(`Asignaciones: ${join(otra, 'asig.json')}`)
    expect(r.salida).toMatch(/P2\s+\| coding_agent \|\s+\| 05:00:00–05:20:00 \| solo propuesto/)
    expect(r.codigo).toBe(0)
  })

  it('tiempos con una carpeta de sesiones o unas asignaciones que no existen: mensaje claro y código 1', () => {
    const raiz = proyecto()
    const falta = join(raiz, 'no-hay-sesiones')
    const r = correr(raiz, 'tiempos', ['--plan', 'plan.json', '--sesiones', sesiones([]), '--sesiones', falta])
    expect(r.salida).toContain(`No existe la carpeta de sesiones: ${falta} (indicada con --sesiones)`)
    expect(r.codigo).toBe(1)
    mkdirSync(falta)
    const r2 = correr(raiz, 'tiempos', ['--plan', 'plan.json', '--sesiones', falta, '--asignaciones', 'asig.json'])
    expect(r2.salida).toContain(`No existe el archivo de asignaciones: ${join(raiz, 'asig.json')} (indicada con --asignaciones)`)
    expect(r2.codigo).toBe(1)
  })
})
