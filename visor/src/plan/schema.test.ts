import { describe, expect, it } from 'vitest'
import ejemplo from '../../../ejemplos/plan.json'
import { validatePlan } from './schema'
import { formatIssue, makeT } from '../i18n/i18n'

const t = makeT('es')
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('esquema de plan.json (visor)', () => {
  it('acepta el plan de ejemplo, con su campo $schema', () => {
    const result = validatePlan(clone(ejemplo))
    expect(result.ok).toBe(true)
  })

  it('rechaza un status inventado con un mensaje claro', () => {
    const plan = clone(ejemplo)
    plan.phases[0].items[0].status = 'terminado'
    const result = validatePlan(plan)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toHaveLength(1)
    expect(formatIssue(result.issues[0], t)).toBe(
      'Estado no válido "terminado" en phases[0].items[0].status (F1 · P1). Valores permitidos: pending, in_progress, needs_you, done, problem.',
    )
  })

  it('rechaza un status a nivel de fase porque se deriva de los items', () => {
    const plan = clone(ejemplo) as unknown as { phases: Record<string, unknown>[] }
    plan.phases[1].status = 'done'
    const result = validatePlan(plan)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => formatIssue(issue, t))).toEqual([
      'La fase phases[1] (F2) tiene "status": el estado de una fase se calcula desde sus items. Quita ese campo.',
    ])
  })

  it('rechaza started_at en un item porque se deriva de work_log', () => {
    const plan = clone(ejemplo) as unknown as { phases: { items: Record<string, unknown>[] }[] }
    plan.phases[0].items[0].started_at = '2026-10-05T09:00:00-05:00'
    const result = validatePlan(plan)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => formatIssue(issue, t))).toEqual(['Campos no reconocidos en phases[0].items[0] (F1 · P1): started_at.'])
  })

  it('rechaza un tramo de work_log con actor inventado', () => {
    const plan = clone(ejemplo) as unknown as { phases: { items: { work_log: Record<string, unknown>[] }[] }[] }
    plan.phases[0].items[0].work_log[0].actor = 'robot'
    const result = validatePlan(plan)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => formatIssue(issue, t))).toEqual([
      'Valor no válido "robot" en phases[0].items[0].work_log[0].actor (F1 · P1). Valores permitidos: orchestrator, coding_agent, subagent, human.',
    ])
  })

  it('rechaza un id de item repetido en otra fase', () => {
    const plan = clone(ejemplo)
    plan.phases[2].items[0].id = 'P1'
    const result = validatePlan(plan)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => formatIssue(issue, t))).toEqual([
      'Id repetido "P1" en phases[2].items[0].id (F3 · P1). Cada item necesita un id único.',
    ])
  })
})
