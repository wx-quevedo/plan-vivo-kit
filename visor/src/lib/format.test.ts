import { describe, expect, it } from 'vitest'
import { formatDuration } from './format'

describe('formateo de duraciones', () => {
  it('59 min se muestra en minutos', () => {
    expect(formatDuration(59)).toBe('59 min')
  })

  it('60 min se muestra como 1 h', () => {
    expect(formatDuration(60)).toBe('1 h')
  })

  it('80 min se muestra como 1 h 20 min, sin horas decimales', () => {
    expect(formatDuration(80)).toBe('1 h 20 min')
  })

  it('150 min se muestra como 2 h 30 min', () => {
    expect(formatDuration(150)).toBe('2 h 30 min')
  })
})
