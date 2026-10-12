import { describe, expect, it } from 'vitest'
import { calibrationOf, computeTimeline } from './timeline'
import type { Actor, Item, Plan } from './schema'

const MIN = 60_000
const NOW = Date.parse('2026-10-11T12:00:00-05:00')
const at = (hhmm: string) => `2026-10-11T${hhmm}:00-05:00`
const ms = (hhmm: string) => Date.parse(at(hhmm))

const item = (over: Partial<Item>): Item => ({
  id: 'X',
  type: 'prompt',
  title: 'x',
  status: 'pending',
  work_log: [],
  summary: '',
  steps: [],
  files_changed: 0,
  notes: '',
  ...over,
})
const tramo = (actor: Actor, start: string, end: string) => ({ actor, start: at(start), end: at(end), note: '', commits: [] })

// Dos items terminados que dan un factor de 0,4: 42 min reales contra 105 de estimado medio.
const terminados = [
  item({ id: 'A1', status: 'done', estimate_min: [60, 90], work_log: [tramo('coding_agent', '08:00', '08:30')] }),
  item({ id: 'A2', status: 'done', estimate_min: [20, 40], work_log: [tramo('coding_agent', '08:40', '08:52')] }),
]

describe('línea de tiempo', () => {
  it('factor de calibración: tiempo real / estimado medio de los items terminados', () => {
    const plan: Pick<Plan, 'phases'> = {
      phases: [
        {
          id: 'F1',
          name: 'F1',
          items: [
            ...terminados,
            // No cuentan: terminado sin tramos, y en curso.
            item({ id: 'A3', status: 'done', estimate_min: [500, 500] }),
            item({ id: 'A4', status: 'in_progress', estimate_min: [10, 10], work_log: [tramo('coding_agent', '09:00', '11:00')] }),
          ],
        },
      ],
    }
    expect(calibrationOf(plan)).toEqual({ factor: 0.4, items: 2, realMin: 42, estimateMin: 105 })
  })

  it('proyección continua: pendiente × factor encadenado desde ahora, con cierre aproximado', () => {
    const plan: Pick<Plan, 'phases'> = {
      phases: [
        { id: 'F1', name: 'F1', items: [...terminados, item({ id: 'B1', estimate_min: [100, 100] })] },
        { id: 'F2', name: 'F2', estimate_min: [50, 50], items: [] },
      ],
    }
    const timeline = computeTimeline(plan, NOW)
    expect(timeline.rows[0].projected).toEqual([NOW, NOW + 40 * MIN])
    expect(timeline.rows[1].projected).toEqual([NOW + 40 * MIN, NOW + 60 * MIN])
    expect(timeline.remainingMin).toBe(60)
    expect(timeline.projectEnd).toBe(NOW + 60 * MIN)
  })

  it('sin items terminados el factor es 1 y la fase en curso descuenta lo ya trabajado', () => {
    const plan: Pick<Plan, 'phases'> = {
      phases: [
        {
          id: 'F1',
          name: 'F1',
          items: [item({ id: 'C1', status: 'in_progress', estimate_min: [80, 120], work_log: [tramo('coding_agent', '11:00', '11:30')] })],
        },
      ],
    }
    const timeline = computeTimeline(plan, NOW)
    expect(timeline.calibration).toBeNull()
    expect(timeline.rows[0].projected).toEqual([NOW, NOW + 70 * MIN])
  })

  it('hueco entre prompts: entre dos items de la misma fase, no cuando se solapan', () => {
    const plan: Pick<Plan, 'phases'> = {
      phases: [
        {
          id: 'F1',
          name: 'F1',
          items: [
            item({ id: 'P1', status: 'done', work_log: [tramo('coding_agent', '08:00', '08:30')] }),
            item({ id: 'P2', status: 'done', work_log: [tramo('coding_agent', '09:00', '10:00')] }),
            // U1 ocurre dentro de P2: no deja hueco.
            item({ id: 'U1', type: 'unplanned', status: 'done', work_log: [tramo('subagent', '09:10', '09:20')] }),
          ],
        },
      ],
    }
    const row = computeTimeline(plan, NOW).rows[0]
    expect(row.promptGaps).toEqual([[ms('08:30'), ms('09:00')]])
    expect(row.segments.map((s) => s.actor)).toEqual(['coding_agent', 'coding_agent', 'subagent'])
    expect(row.lanes).toBe(2)
  })

  it('hueco en espera: dentro de un item, sin actor', () => {
    const plan: Pick<Plan, 'phases'> = {
      phases: [{ id: 'F1', name: 'F1', items: [item({ id: 'P2', status: 'done', work_log: [tramo('coding_agent', '08:00', '08:10'), tramo('coding_agent', '08:25', '08:30')] })] }],
    }
    const row = computeTimeline(plan, NOW).rows[0]
    expect(row.waitGaps).toEqual([[ms('08:10'), ms('08:25')]])
    expect(row.promptGaps).toEqual([])
  })

  it('un mismo tramo registrado en dos items se dibuja una sola vez en la fase', () => {
    const compartido = tramo('subagent', '09:10', '09:20')
    const plan: Pick<Plan, 'phases'> = {
      phases: [
        {
          id: 'F1',
          name: 'F1',
          items: [
            item({ id: 'P3', status: 'done', work_log: [tramo('coding_agent', '09:00', '10:00'), compartido] }),
            item({ id: 'U1', type: 'unplanned', status: 'done', work_log: [compartido] }),
          ],
        },
      ],
    }
    const row = computeTimeline(plan, NOW).rows[0]
    expect(row.segments.map((s) => [s.actor, s.itemId])).toEqual([
      ['coding_agent', 'P3'],
      ['subagent', 'P3, U1'],
    ])
  })

  it('item sin work_log: la fase no dibuja tramos ni barra de estimado', () => {
    const plan: Pick<Plan, 'phases'> = { phases: [{ id: 'F1', name: 'F1', items: [item({ id: 'P4', estimate_min: [60, 120] })] }] }
    const row = computeTimeline(plan, NOW).rows[0]
    expect(row.segments).toEqual([])
    expect(row.estimate).toBeNull()
  })

  it('marca como sin estimar una fase sin items ni estimate_min', () => {
    const timeline = computeTimeline({ phases: [{ id: 'C', name: 'C', items: [] }] }, NOW)
    expect(timeline.rows[0]).toMatchObject({ unestimated: true, projected: null })
    expect(timeline.unestimatedCount).toBe(1)
  })

  it('proyecta una fase sin items que tiene estimate_min propio, con su estimado medio', () => {
    const timeline = computeTimeline({ phases: [{ id: 'D', name: 'D', estimate_min: [60, 240], items: [] }] }, NOW)
    expect(timeline.rows[0]).toMatchObject({ unestimated: false, projected: [NOW, NOW + 150 * MIN] })
    expect(timeline.projectEnd).toBe(NOW + 150 * MIN)
  })
})
