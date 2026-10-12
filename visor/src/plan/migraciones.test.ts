import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RAIZ_KIT } from '../../../configuracion.ts'
import { migrar, versionDe } from './migraciones'
import { validatePlan, VERSION_ESQUEMA } from './schema'

// Plan de antes de schema_version: la versión iba en el campo "schema".
const sinVersion = () => ({
  $schema: '../plan-vivo/schema/plan.schema.json',
  schema: 1,
  project: 'prueba',
  title: 'Prueba',
  updated_at: '2026-10-11T10:00:00-05:00',
  phases: [{ id: 'F1', name: 'Base', items: [{ id: 'P1', type: 'prompt', title: 'x', status: 'pending', estimate_min: [30, 60] }] }],
})

describe('migraciones del formato', () => {
  it('la versión actual es 1, y un plan sin schema_version es de la versión 0', () => {
    expect(VERSION_ESQUEMA).toBe(1)
    expect(versionDe(sinVersion())).toBe(0)
    expect(versionDe({ schema_version: 1 })).toBe(1)
  })

  it('de 0 a 1: agrega schema_version después de $schema y quita el campo schema, sin tocar el original', () => {
    const original = sinVersion()
    const r = migrar(original)
    expect(Object.keys(r.plan)).toEqual(['$schema', 'schema_version', 'project', 'title', 'updated_at', 'phases'])
    expect(r.plan.schema_version).toBe(1)
    expect([r.desde, r.hasta]).toEqual([0, 1])
    expect(r.cambios).toEqual([{ hasta: 1, lineas: ['+ schema_version: 1', '- schema: 1 (lo reemplaza schema_version)'] }])
    expect(original).toEqual(sinVersion())
    expect(validatePlan(r.plan).ok).toBe(true)
  })

  it('sin $schema ni schema: schema_version queda primero', () => {
    const { $schema: _a, schema: _b, ...resto } = sinVersion()
    const r = migrar(resto)
    expect(Object.keys(r.plan)[0]).toBe('schema_version')
    expect(r.cambios[0].lineas).toEqual(['+ schema_version: 1'])
  })

  it('migrar dos veces no cambia nada la segunda', () => {
    const una = migrar(sinVersion()).plan
    const dos = migrar(una)
    expect(dos.cambios).toEqual([])
    expect(dos.plan).toEqual(una)
  })

  it('una versión más nueva que la del kit, o un schema_version que no es entero, son errores claros', () => {
    expect(() => migrar({ schema_version: 2 })).toThrow('El plan es de la versión 2 del formato y este kit llega a la 1: actualiza el kit.')
    expect(() => migrar({ schema_version: '1' })).toThrow(/schema_version no válido: "1"/)
    expect(() => migrar({ schema_version: 0 })).toThrow(/schema_version no válido: 0/)
  })

  it('el esquema acepta el plan sin migrar (para seguir viéndolo) y rechaza otra versión', () => {
    expect(validatePlan(sinVersion()).ok).toBe(true)
    expect(validatePlan({ ...migrar(sinVersion()).plan, schema_version: 2 }).ok).toBe(false)
  })
})

// Entorno limpio: sin las variables PLAN_VIVO_* ni el INIT_CWD de quien corre las pruebas.
function entornoLimpio(): NodeJS.ProcessEnv {
  const entorno = { ...process.env }
  for (const clave of Object.keys(entorno)) if (clave.startsWith('PLAN_VIVO_') || clave === 'INIT_CWD') delete entorno[clave]
  return entorno
}

// Corre un comando del kit desde una carpeta de proyecto: pnpm --dir <kit> <comando> -- <argumentos>.
function correr(cwd: string, comando: string, args: string[]): { codigo: number; salida: string } {
  const r = spawnSync(`pnpm --silent --dir "${RAIZ_KIT}" ${comando} -- ${args.map((a) => `"${a}"`).join(' ')}`, {
    cwd,
    env: entornoLimpio(),
    shell: true,
    encoding: 'utf8',
  })
  return { codigo: r.status ?? -1, salida: `${r.stdout}${r.stderr}` }
}

function proyecto(): { raiz: string; plan: string; texto: string } {
  const raiz = mkdtempSync(join(tmpdir(), 'migrar-'))
  const plan = join(raiz, 'plan.json')
  const texto = JSON.stringify(sinVersion(), null, 2)
  writeFileSync(plan, texto)
  return { raiz, plan, texto }
}

describe('pnpm migrar y pnpm validar', { timeout: 60_000 }, () => {
  it('sin --aplicar muestra los cambios y no escribe nada', () => {
    const { raiz, plan, texto } = proyecto()
    const r = correr(raiz, 'migrar', ['--plan', 'plan.json'])
    expect(r.codigo).toBe(0)
    expect(r.salida).toContain('Versión del formato: 0 -> 1')
    expect(r.salida).toContain('+ schema_version: 1')
    expect(r.salida).toContain('Modo de revisión: no se escribió nada')
    expect(readFileSync(plan, 'utf8')).toBe(texto)
    expect(readdirSync(raiz)).toEqual(['plan.json'])
  })

  it('con --aplicar escribe el plan migrado y deja el original en plan.json.bak; una segunda vez no cambia nada', () => {
    const { raiz, plan, texto } = proyecto()
    const r = correr(raiz, 'migrar', ['--plan', plan, '--aplicar'])
    expect(r.codigo).toBe(0)
    expect(r.salida).toContain(`Copia del original: ${plan}.bak`)
    expect(readFileSync(`${plan}.bak`, 'utf8')).toBe(texto)
    const migrado = readFileSync(plan, 'utf8')
    expect(JSON.parse(migrado)).toEqual(migrar(sinVersion()).plan)
    expect(migrado).toContain('"estimate_min": [30, 60]')

    const otra = correr(raiz, 'migrar', ['--plan', plan, '--aplicar'])
    expect(otra.codigo).toBe(0)
    expect(otra.salida).toContain('Ya está en la versión 1 del formato: no hay nada que migrar.')
    expect(readFileSync(plan, 'utf8')).toBe(migrado)
    expect(readdirSync(raiz).sort()).toEqual(['plan.json', 'plan.json.bak'])
  })

  it('si ya hay un plan.json.bak, no lo pisa: la copia nueva lleva la fecha', () => {
    const { raiz, plan } = proyecto()
    writeFileSync(`${plan}.bak`, 'copia anterior')
    expect(correr(raiz, 'migrar', ['--plan', plan, '--aplicar']).codigo).toBe(0)
    expect(readFileSync(`${plan}.bak`, 'utf8')).toBe('copia anterior')
    expect(readdirSync(raiz).filter((n) => /^plan\.json\.\d{4}-.+\.bak$/.test(n))).toHaveLength(1)
  })

  it('un plan migrado que no cumple el esquema no se escribe', () => {
    const { raiz, plan } = proyecto()
    const roto = JSON.stringify({ ...sinVersion(), title: '' })
    writeFileSync(plan, roto)
    const r = correr(raiz, 'migrar', ['--plan', plan, '--aplicar'])
    expect(r.codigo).toBe(1)
    expect(r.salida).toContain('no se escribió nada')
    expect(readFileSync(plan, 'utf8')).toBe(roto)
    expect(existsSync(`${plan}.bak`)).toBe(false)
  })

  it('validar avisa si falta schema_version, sin fallar; con el plan migrado no avisa', () => {
    const { raiz, plan } = proyecto()
    const antes = correr(raiz, 'validar', ['--plan', plan])
    expect(antes.codigo).toBe(0)
    expect(antes.salida).toContain('Aviso: falta schema_version')
    correr(raiz, 'migrar', ['--plan', plan, '--aplicar'])
    const despues = correr(raiz, 'validar', ['--plan', plan])
    expect(despues.codigo).toBe(0)
    expect(despues.salida).not.toContain('Aviso')
  })
})
