import { describe, expect, it } from 'vitest'
import { aLocal, desfaseMin, nombreDeZona } from './zona'
import { timeTicks } from './format'

const HORA = 3_600_000

describe('zona horaria configurable', () => {
  it('Guayaquil: desfase fijo de -05:00', () => {
    expect(desfaseMin(Date.parse('2026-01-15T12:00:00Z'), 'America/Guayaquil')).toBe(-300)
    expect(desfaseMin(Date.parse('2026-07-15T12:00:00Z'), 'America/Guayaquil')).toBe(-300)
    expect(aLocal(Date.parse('2026-10-09T19:12:00Z'), 'America/Guayaquil')).toBe('2026-10-09T14:12:00-05:00')
  })

  it('Madrid: el desfase cambia con el horario de verano', () => {
    expect(desfaseMin(Date.parse('2026-01-15T12:00:00Z'), 'Europe/Madrid')).toBe(60)
    expect(desfaseMin(Date.parse('2026-07-15T12:00:00Z'), 'Europe/Madrid')).toBe(120)
    expect(aLocal(Date.parse('2026-07-15T12:00:00Z'), 'Europe/Madrid')).toBe('2026-07-15T14:00:00+02:00')
  })

  it('UTC y zonas con media hora', () => {
    expect(aLocal(Date.parse('2026-10-09T19:12:05Z'), 'UTC')).toBe('2026-10-09T19:12:05+00:00')
    expect(aLocal(Date.parse('2026-10-09T19:12:00Z'), 'Asia/Kolkata')).toBe('2026-10-10T00:42:00+05:30')
  })

  it('las marcas del eje caen en horas en punto de la zona pedida', () => {
    const inicio = Date.parse('2026-10-09T10:20:00Z')
    const guayaquil = timeTicks([inicio, inicio + 10 * HORA], 10, 'America/Guayaquil').ticks
    const kolkata = timeTicks([inicio, inicio + 10 * HORA], 10, 'Asia/Kolkata').ticks
    expect(new Date(guayaquil[0]).toISOString()).toBe('2026-10-09T11:00:00.000Z')
    // En Kolkata (+05:30) la hora en punto local es a los 30 minutos UTC.
    expect(new Date(kolkata[0]).toISOString()).toBe('2026-10-09T10:30:00.000Z')
  })

  it('nombre corto de la zona para el encabezado', () => {
    expect(nombreDeZona('America/Guayaquil')).toBe('Guayaquil')
    expect(nombreDeZona('America/Argentina/Buenos_Aires')).toBe('Buenos Aires')
    expect(nombreDeZona('UTC')).toBe('UTC')
  })
})
