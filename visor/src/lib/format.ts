import { desfaseMin } from './zona'

// Zona horaria del visor: la de la configuración (plan-vivo.config.json o --zona); America/Guayaquil por defecto.
export const TIME_ZONE: string = typeof __PLAN_VIVO__ !== 'undefined' ? __PLAN_VIVO__.zona : 'America/Guayaquil'

// Duración legible: minutos si es menor a 60; si no, horas y minutos. Nunca horas decimales.
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.round(totalMinutes)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function formatRange([min, max]: [number, number]): string {
  return min === max ? formatDuration(min) : `${formatDuration(min)} – ${formatDuration(max)}`
}

const locales = { es: 'es-EC', en: 'en-US' } as const

export function formatDateTime(value: string | number, lang: keyof typeof locales): string {
  return new Intl.DateTimeFormat(locales[lang], {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export function formatTick(value: number, lang: keyof typeof locales, withTime: boolean): string {
  return new Intl.DateTimeFormat(locales[lang], {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(new Date(value))
}

const HOUR = 60 * 60_000
const DAY = 24 * HOUR
const STEPS = [15 * 60_000, 30 * 60_000, HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY]

// Marcas del eje alineadas a la hora local de la zona. El desfase se toma al inicio del rango: si la zona cambia de
// horario de verano dentro del rango, las marcas posteriores quedan corridas una hora (solo afecta las etiquetas).
export function timeTicks([start, end]: [number, number], target = 6, zone = TIME_ZONE): { ticks: number[]; step: number } {
  const step = STEPS.find((s) => (end - start) / s <= target) ?? STEPS[STEPS.length - 1]
  const offset = desfaseMin(start, zone) * 60_000
  const first = Math.ceil((start + offset) / step) * step - offset
  const ticks: number[] = []
  for (let t = first; t <= end; t += step) ticks.push(t)
  return { ticks, step }
}

export const DAY_MS = DAY
