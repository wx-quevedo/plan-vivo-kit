import { phaseEstimate, phaseStatus } from './derive'
import type { Item, Plan, Status } from './schema'
import { assignLanes, gapsOf, itemTimes, segmentsOf, type Segment, type Span } from './worklog'

export type { Span } from './worklog'

const MINUTE = 60_000

export interface TimelineRow {
  phaseId: string
  name: string
  status: Status
  // Rango estimado en minutos [mínimo, máximo]; null si la fase no tiene estimado.
  estimateMin: [number, number] | null
  // Barra tenue: desde el inicio real de la fase, con el estimado máximo de largo (D11).
  estimate: Span | null
  // Tramos reales por actor, con carril para los que se solapan. Las pausas quedan como huecos vacíos.
  segments: Segment[]
  lanes: number
  // Huecos entre un item y el siguiente de la misma fase: se rotulan "entre prompts".
  promptGaps: Span[]
  // Huecos dentro de un mismo item, sin actor: revisión, consulta o pausa; no hay dato para distinguirlos.
  waitGaps: Span[]
  // Barra punteada: lo que falta de la fase, ajustado por el factor de calibración, encadenado desde ahora.
  projected: Span | null
  remainingMin: number
  unestimated: boolean
}

export interface Calibration {
  // Tiempo real total / estimado medio total de los items terminados con tramos y estimado.
  factor: number
  items: number
  realMin: number
  estimateMin: number
}

export interface Timeline {
  rows: TimelineRow[]
  domain: Span
  // null cuando no hay items terminados con tramos y estimado: se proyecta con factor 1.
  calibration: Calibration | null
  remainingMin: number
  // Cierre aproximado: ahora más todo lo que falta, con trabajo continuo (D18).
  projectEnd: number | null
  unestimatedCount: number
}

const mean = ([min, max]: [number, number]) => (min + max) / 2

export function calibrationOf(plan: Pick<Plan, 'phases'>): Calibration | null {
  let realMin = 0
  let estimateMin = 0
  let items = 0
  for (const item of plan.phases.flatMap((phase) => phase.items)) {
    if (item.status !== 'done' || !item.estimate_min) continue
    const times = itemTimes(item)
    if (!times) continue
    realMin += times.realMin
    estimateMin += mean(item.estimate_min)
    items++
  }
  if (items === 0 || estimateMin === 0) return null
  return { factor: realMin / estimateMin, items, realMin, estimateMin }
}

// Minutos que le faltan a un item: estimado medio × factor, menos lo ya trabajado si está en curso.
function itemRemaining(item: Item, factor: number): number {
  if (item.status === 'done' || !item.estimate_min) return 0
  const adjusted = mean(item.estimate_min) * factor
  const worked = itemTimes(item)?.realMin ?? 0
  return Math.max(0, adjusted - worked)
}

// Huecos entre items consecutivos (ordenados por inicio), con el fin acumulado para no marcar solapes.
function promptGapsOf(items: Item[]): Span[] {
  const spans = items
    .map((item) => itemTimes(item))
    .filter((times): times is NonNullable<typeof times> => times !== null)
    .sort((a, b) => a.start - b.start)
  const gaps: Span[] = []
  let maxEnd: number | null = null
  for (const times of spans) {
    if (maxEnd !== null && times.start > maxEnd) gaps.push([maxEnd, times.start])
    maxEnd = maxEnd === null ? times.end : Math.max(maxEnd, times.end)
  }
  return gaps
}

// Un mismo tramo registrado en dos items (un subagente que trabajó para ambos) se dibuja una sola vez.
function dedupe(segments: Segment[]): Segment[] {
  const byKey = new Map<string, Segment>()
  for (const segment of segments) {
    const key = `${segment.actor}|${segment.start}|${segment.end}`
    const seen = byKey.get(key)
    if (seen) seen.itemId = `${seen.itemId}, ${segment.itemId}`
    else byKey.set(key, { ...segment })
  }
  return [...byKey.values()]
}

export function computeTimeline(plan: Pick<Plan, 'phases'>, now: number): Timeline {
  const calibration = calibrationOf(plan)
  const factor = calibration?.factor ?? 1
  // Proyección continua, 24 h al día, desde ahora (D18).
  let cursor = now

  const rows = plan.phases.map<TimelineRow>((phase) => {
    const status = phaseStatus(phase)
    const estimateMin = phaseEstimate(phase)
    const { segments, lanes } = assignLanes(dedupe(phase.items.flatMap((item) => segmentsOf(item))))
    const realStart = segments.length ? Math.min(...segments.map((s) => s.start)) : null
    const row: TimelineRow = {
      phaseId: phase.id,
      name: phase.name,
      status,
      estimateMin,
      estimate: realStart !== null && estimateMin ? [realStart, realStart + estimateMin[1] * MINUTE] : null,
      segments,
      lanes,
      promptGaps: promptGapsOf(phase.items),
      waitGaps: phase.items.flatMap((item) => gapsOf(segmentsOf(item).map((s): Span => [s.start, s.end]))),
      projected: null,
      remainingMin: 0,
      unestimated: false,
    }

    if (status === 'done') return row
    let remaining: number
    if (phase.items.some((item) => item.estimate_min)) {
      remaining = phase.items.reduce((sum, item) => sum + itemRemaining(item, factor), 0)
    } else if (phase.items.length === 0 && phase.estimate_min) {
      remaining = mean(phase.estimate_min) * factor
    } else if (phase.items.length === 0) {
      row.unestimated = true
      return row
    } else {
      remaining = 0
    }

    row.remainingMin = remaining
    if (remaining > 0) {
      row.projected = [cursor, cursor + remaining * MINUTE]
      cursor = row.projected[1]
    }
    return row
  })

  const remainingMin = rows.reduce((sum, row) => sum + row.remainingMin, 0)
  const anyEstimate = rows.some((row) => !row.unestimated && row.estimateMin !== null)
  const starts = rows.flatMap((r) => [...r.segments.map((s) => s.start), r.estimate?.[0] ?? Infinity, r.projected?.[0] ?? Infinity])
  const ends = rows.flatMap((r) => [...r.segments.map((s) => s.end), r.estimate?.[1] ?? -Infinity, r.projected?.[1] ?? -Infinity])
  const domainStart = Math.min(now, ...starts)
  const domainEnd = Math.max(now, ...ends)

  return {
    rows,
    domain: [domainStart, Math.max(domainEnd, domainStart + 60 * MINUTE)],
    calibration,
    remainingMin,
    projectEnd: anyEstimate ? now + remainingMin * MINUTE : null,
    unestimatedCount: rows.filter((r) => r.unestimated).length,
  }
}
