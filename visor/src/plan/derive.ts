import type { Phase, Status } from './schema'

// Estado de la fase derivado de sus items. El orden de las reglas importa.
export function phaseStatus(phase: Pick<Phase, 'items'>): Status {
  const statuses = phase.items.map((item) => item.status)
  if (statuses.includes('problem')) return 'problem'
  if (statuses.includes('needs_you')) return 'needs_you'
  if (statuses.length > 0 && statuses.every((s) => s === 'done')) return 'done'
  if (statuses.some((s) => s === 'in_progress' || s === 'done')) return 'in_progress'
  return 'pending'
}

export interface Progress {
  done: number
  total: number
  percent: number
}

// Avance de la fase: items terminados sobre el total (prompts, puertas e imprevistos).
export function phaseProgress(phase: Pick<Phase, 'items'>): Progress {
  const total = phase.items.length
  const done = phase.items.filter((item) => item.status === 'done').length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return { done, total, percent }
}

// Rango estimado de la fase en minutos: suma de los estimados de sus items;
// si ningún item tiene estimado, el estimate_min propio de la fase; si no, null.
export function phaseEstimate(phase: Pick<Phase, 'items' | 'estimate_min'>): [number, number] | null {
  const ranges = phase.items.map((item) => item.estimate_min).filter((r): r is [number, number] => Array.isArray(r))
  if (ranges.length > 0) {
    return ranges.reduce<[number, number]>((acc, [min, max]) => [acc[0] + min, acc[1] + max], [0, 0])
  }
  return phase.estimate_min ?? null
}

// Primera fase en curso: donde va el marcador "Estás aquí".
export function currentPhaseId(phases: Phase[]): string | null {
  return phases.find((phase) => phaseStatus(phase) === 'in_progress')?.id ?? null
}
