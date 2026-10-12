import type { Actor, Item } from './schema'

const MINUTE = 60_000

export type Span = [number, number]

export interface Segment {
  actor: Actor
  start: number
  end: number
  note: string
  itemId: string
  // Carril para dibujar tramos que se solapan (agente y subagente a la vez) uno debajo del otro.
  lane: number
}

export interface ItemTimes {
  start: number
  end: number
  // Duración de la unión de los tramos: el tiempo en que dos actores trabajan a la vez cuenta una sola vez.
  realMin: number
}

export function segmentsOf(item: Pick<Item, 'id' | 'work_log'>): Segment[] {
  return item.work_log
    .map((entry) => ({
      actor: entry.actor,
      start: Date.parse(entry.start),
      end: Date.parse(entry.end),
      note: entry.note,
      itemId: item.id,
      lane: 0,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end)
}

// Une intervalos que se solapan o se tocan.
export function union(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0])
  const merged: Span[] = []
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  return merged
}

// Inicio (mínimo), fin (máximo) y tiempo real (unión) de un item; null si no tiene tramos.
export function itemTimes(item: Pick<Item, 'id' | 'work_log'>): ItemTimes | null {
  const segments = segmentsOf(item)
  if (segments.length === 0) return null
  const merged = union(segments.map((s) => [s.start, s.end]))
  const totalMs = merged.reduce((sum, [start, end]) => sum + (end - start), 0)
  return {
    start: merged[0][0],
    end: merged[merged.length - 1][1],
    realMin: Math.round(totalMs / MINUTE),
  }
}

// Huecos dentro de un conjunto de tramos (las pausas): lo que falta entre la unión de los tramos.
export function gapsOf(spans: Span[]): Span[] {
  const merged = union(spans)
  const gaps: Span[] = []
  for (let i = 1; i < merged.length; i++) gaps.push([merged[i - 1][1], merged[i][0]])
  return gaps
}

// Asigna carriles: un tramo va al primer carril libre; así los solapes se ven uno debajo del otro.
export function assignLanes(segments: Segment[]): { segments: Segment[]; lanes: number } {
  const laneEnds: number[] = []
  const placed = [...segments]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((segment) => {
      let lane = laneEnds.findIndex((end) => end <= segment.start)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(segment.end)
      } else {
        laneEnds[lane] = segment.end
      }
      return { ...segment, lane }
    })
  return { segments: placed, lanes: Math.max(1, laneEnds.length) }
}

// Commits del item: unión de los commits de sus tramos, en orden de aparición y sin repetir.
export function itemCommits(item: Pick<Item, 'work_log'>): string[] {
  return [...new Set(item.work_log.flatMap((entry) => entry.commits))]
}

// Tiempo real de una fase: la unión de los tramos de todos sus items, igual que en un item (D20); el tiempo en que
// dos items o actores trabajan a la vez cuenta una sola vez. null si ningún item tiene tramos.
export function phaseRealMin(phase: { items: Pick<Item, 'id' | 'work_log'>[] }): number | null {
  const spans: Span[] = phase.items.flatMap((item) => segmentsOf(item).map((s): Span => [s.start, s.end]))
  if (spans.length === 0) return null
  const totalMs = union(spans).reduce((sum, [start, end]) => sum + (end - start), 0)
  return Math.round(totalMs / MINUTE)
}
