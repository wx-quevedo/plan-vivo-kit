// schema/plan.schema.json (para editores y otros lenguajes) y el esquema del visor (zod) deben decir lo mismo.
import { describe, expect, it } from 'vitest'
import { Ajv2020 } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import esquema from '../../../schema/plan.schema.json'
import ejemplo from '../../../ejemplos/plan.json'
import inicial from '../../../ejemplos/plan-inicial.json'
import { validatePlan } from './schema'

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const validarJson = ajv.compile(esquema)

type Plano = Record<string, any>
const clone = (): Plano => JSON.parse(JSON.stringify(ejemplo))
const conCambio = (cambiar: (plan: Plano) => void): Plano => {
  const plan = clone()
  cambiar(plan)
  return plan
}

describe('JSON Schema del plan', () => {
  it('el plan de ejemplo cumple schema/plan.schema.json', () => {
    const ok = validarJson(clone())
    expect(validarJson.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  it('la plantilla para empezar un proyecto (ejemplos/plan-inicial.json) cumple los dos esquemas', () => {
    expect(validarJson(inicial), JSON.stringify(validarJson.errors)).toBe(true)
    expect(validatePlan(inicial).ok).toBe(true)
  })

  it('el ejemplo tiene lo que pide el kit: 3 fases, items terminados, en curso y pendientes, una puerta y un imprevisto', () => {
    const items = ejemplo.phases.flatMap((fase) => fase.items)
    expect(ejemplo.phases).toHaveLength(3)
    for (const estado of ['done', 'in_progress', 'pending']) expect(items.some((item) => item.status === estado)).toBe(true)
    expect(items.some((item) => item.type === 'gate')).toBe(true)
    expect(items.some((item) => item.type === 'unplanned')).toBe(true)
    const actores = new Set(items.flatMap((item) => item.work_log.map((tramo) => tramo.actor)))
    expect([...actores].sort()).toEqual(['coding_agent', 'human', 'orchestrator', 'subagent'])
  })

  // Cada caso inválido debe ser rechazado por los dos esquemas.
  const invalidos: [string, (plan: Plano) => void][] = [
    ['status inventado', (p) => (p.phases[0].items[0].status = 'terminado')],
    ['tipo de item inventado', (p) => (p.phases[0].items[0].type = 'tarea')],
    ['actor inventado', (p) => (p.phases[0].items[0].work_log[0].actor = 'robot')],
    ['status en una fase', (p) => (p.phases[0].status = 'done')],
    ['campo derivado en un item (started_at)', (p) => (p.phases[0].items[0].started_at = '2026-10-05T09:00:00-05:00')],
    ['campo desconocido en la raíz', (p) => (p.owner = 'alguien')],
    ['fecha sin zona', (p) => (p.updated_at = '2026-10-09T15:00:00')],
    ['fecha que no es fecha', (p) => (p.phases[0].items[0].work_log[0].start = 'ayer')],
    ['versión de formato distinta de 1', (p) => (p.schema = 2)],
    ['plan sin fases', (p) => (p.phases = [])],
    ['falta el título del item', (p) => delete p.phases[0].items[0].title],
    ['estimado con un solo número', (p) => (p.phases[0].items[0].estimate_min = [30])],
    ['estimado negativo', (p) => (p.phases[0].items[0].estimate_min = [-5, 10])],
    ['dificultad fuera de 1 a 10', (p) => (p.phases[0].items[0].difficulty = 11)],
    ['files_changed con decimales', (p) => (p.phases[0].items[0].files_changed = 1.5)],
    ['tramo sin actor', (p) => delete p.phases[0].items[0].work_log[0].actor],
  ]
  for (const [nombre, cambiar] of invalidos) {
    it(`rechaza en ambos esquemas: ${nombre}`, () => {
      const plan = conCambio(cambiar)
      expect(validarJson(plan)).toBe(false)
      expect(validatePlan(plan).ok).toBe(false)
    })
  }

  // Y cada variante válida, aceptada por los dos.
  const validos: [string, (plan: Plano) => void][] = [
    ['sin campos opcionales en un item', (p) => (p.phases[2].items[0] = { id: 'P6', type: 'prompt', title: 'x', status: 'pending' })],
    ['estimado null', (p) => (p.phases[0].items[0].estimate_min = null)],
    ['fecha en UTC con Z', (p) => (p.updated_at = '2026-10-09T20:00:00Z')],
    ['fase sin items con estimado propio', (p) => p.phases.push({ id: 'F4', name: 'Más adelante', estimate_min: [60, 120], items: [] })],
    ['sin $schema ni listas informativas', (p) => ['$schema', 'status_values', 'item_types'].forEach((k) => delete p[k])],
  ]
  for (const [nombre, cambiar] of validos) {
    it(`acepta en ambos esquemas: ${nombre}`, () => {
      const plan = conCambio(cambiar)
      expect(validarJson(plan), JSON.stringify(validarJson.errors)).toBe(true)
      expect(validatePlan(plan).ok).toBe(true)
    })
  }

  it('sin validar formatos (muchos editores no lo hacen), el patrón de fecha igual exige la zona', () => {
    const sinFormatos = new Ajv2020({ allErrors: true, strict: true, validateFormats: false }).compile(esquema)
    expect(sinFormatos(clone())).toBe(true)
    expect(sinFormatos(conCambio((p) => (p.updated_at = '2026-10-09T15:00:00')))).toBe(false)
    expect(sinFormatos(conCambio((p) => (p.phases[0].items[0].work_log[0].end = '9 oct 2026')))).toBe(false)
  })

  it('las reglas que JSON Schema no expresa (fin antes del inicio, rango invertido, id repetido) las rechaza el visor', () => {
    const casos = [
      conCambio((p) => (p.phases[0].items[0].work_log[0].end = p.phases[0].items[0].work_log[0].start)),
      conCambio((p) => (p.phases[0].items[0].estimate_min = [60, 30])),
      conCambio((p) => (p.phases[1].items[0].id = 'P1')),
    ]
    for (const plan of casos) {
      expect(validarJson(plan)).toBe(true)
      expect(validatePlan(plan).ok).toBe(false)
    }
  })
})
