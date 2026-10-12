import { describe, expect, it } from 'vitest'
import { assignLanes, gapsOf, itemCommits, itemTimes, phaseRealMin, segmentsOf } from './worklog'
import type { Actor } from './schema'

const at = (hhmm: string) => `2026-10-11T${hhmm}:00-05:00`
const ms = (hhmm: string) => Date.parse(at(hhmm))
const log = (...entries: [Actor, string, string][]) => entries.map(([actor, start, end]) => ({ actor, start: at(start), end: at(end), note: '', commits: [] as string[] }))

describe('registro de tiempo (work_log)', () => {
  it('real con tramos solapados: agente y subagente a la vez cuentan una sola vez', () => {
    const item = { id: 'P9', work_log: log(['coding_agent', '10:00', '10:30'], ['subagent', '10:10', '10:40']) }
    expect(itemTimes(item)).toEqual({ start: ms('10:00'), end: ms('10:40'), realMin: 40 })
  })

  it('los tramos solapados se muestran ambos, cada uno en su carril', () => {
    const item = { id: 'P9', work_log: log(['coding_agent', '10:00', '10:30'], ['subagent', '10:10', '10:40'], ['coding_agent', '10:45', '11:00']) }
    const { segments, lanes } = assignLanes(segmentsOf(item))
    expect(lanes).toBe(2)
    expect(segments.map((s) => [s.actor, s.lane])).toEqual([
      ['coding_agent', 0],
      ['subagent', 1],
      ['coding_agent', 0],
    ])
  })

  it('huecos: las pausas entre tramos no cuentan como tiempo real', () => {
    const item = { id: 'P9', work_log: log(['coding_agent', '10:00', '10:20'], ['human', '10:50', '11:00']) }
    expect(itemTimes(item)).toEqual({ start: ms('10:00'), end: ms('11:00'), realMin: 30 })
    expect(gapsOf(segmentsOf(item).map((s) => [s.start, s.end]))).toEqual([[ms('10:20'), ms('10:50')]])
  })

  it('commits del item: unión de los commits de sus tramos, sin repetir', () => {
    const [a, b] = log(['coding_agent', '10:00', '10:30'], ['subagent', '10:10', '10:40'])
    const item = { work_log: [{ ...a, commits: ['aaa1111', 'bbb2222'] }, { ...b, commits: ['bbb2222', 'ccc3333'] }] }
    expect(itemCommits(item)).toEqual(['aaa1111', 'bbb2222', 'ccc3333'])
  })

  it('item sin work_log: sin inicio, fin ni tiempo real (no cero)', () => {
    expect(itemTimes({ id: 'G1', work_log: [] })).toBeNull()
  })
})

describe('tiempo real de una fase', () => {
  const tramo = (start: string, end: string) => ({ actor: 'coding_agent' as const, start, end, note: '', commits: [] })
  it('une los tramos de todos sus items: lo que se solapa cuenta una vez', () => {
    const fase = {
      items: [
        { id: 'P1', work_log: [tramo('2026-10-11T10:00:00-05:00', '2026-10-11T10:30:00-05:00')] },
        // Se solapa 10 min con P1 y agrega 20 min propios.
        { id: 'U1', work_log: [tramo('2026-10-11T10:20:00-05:00', '2026-10-11T10:50:00-05:00')] },
        { id: 'P2', work_log: [tramo('2026-10-11T12:00:00-05:00', '2026-10-11T13:15:00-05:00')] },
      ],
    }
    expect(phaseRealMin(fase)).toBe(50 + 75)
  })

  it('sin tramos no hay tiempo real', () => {
    expect(phaseRealMin({ items: [{ id: 'P7', work_log: [] }] })).toBeNull()
    expect(phaseRealMin({ items: [] })).toBeNull()
  })
})
