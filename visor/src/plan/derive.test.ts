import { describe, expect, it } from 'vitest'
import { phaseProgress, phaseStatus } from './derive'
import type { Status } from './schema'

const phase = (...statuses: Status[]) => ({ items: statuses.map((status) => ({ status })) }) as Parameters<typeof phaseStatus>[0]

describe('estado derivado de la fase', () => {
  it('regla 1: problem si algún item está en problem (gana a needs_you)', () => {
    expect(phaseStatus(phase('done', 'needs_you', 'problem'))).toBe('problem')
  })

  it('regla 2: needs_you si algún item está en needs_you', () => {
    expect(phaseStatus(phase('in_progress', 'needs_you', 'pending'))).toBe('needs_you')
  })

  it('regla 3: done si todos los items están done', () => {
    expect(phaseStatus(phase('done', 'done', 'done'))).toBe('done')
  })

  it('regla 4: in_progress si alguno está in_progress o done', () => {
    expect(phaseStatus(phase('done', 'pending'))).toBe('in_progress')
    expect(phaseStatus(phase('pending', 'in_progress'))).toBe('in_progress')
  })

  it('regla 5: pending si todos los items están pendientes', () => {
    expect(phaseStatus(phase('pending', 'pending'))).toBe('pending')
  })

  it('regla 5: pending en una fase sin items', () => {
    expect(phaseStatus(phase())).toBe('pending')
  })
})

describe('avance por fase', () => {
  it('cuenta los items terminados sobre el total', () => {
    expect(phaseProgress(phase('done', 'in_progress', 'pending', 'done'))).toEqual({ done: 2, total: 4, percent: 50 })
    expect(phaseProgress(phase('done', 'pending', 'pending'))).toEqual({ done: 1, total: 3, percent: 33 })
  })

  it('una fase sin items tiene 0 % de avance', () => {
    expect(phaseProgress(phase())).toEqual({ done: 0, total: 0, percent: 0 })
  })
})
