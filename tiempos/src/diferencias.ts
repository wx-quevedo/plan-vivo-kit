import type { PlanJson, TramoPlan } from './plan'
import { aTramoPlan } from './plan'
import type { Tramo } from './tramos'

// "manual (se conserva)": tramo del orquestador cargado a mano; --aplicar no lo toca.
export type Estado = 'igual' | 'distinto' | 'solo en plan.json' | 'solo propuesto' | 'manual (se conserva)'

export interface Fila {
  item: string
  actor: string
  actual: string
  propuesto: string
  estado: Estado
  commits: string
}

// Tolerancia al comparar horas: los tramos manuales se escribieron con precisión de segundos.
const TOLERANCIA_MS = 2000
const hora = (iso: string) => iso.slice(11, 19)
const rango = (t: TramoPlan) => `${hora(t.start)}–${hora(t.end)}`
const cerca = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= TOLERANCIA_MS

export function diferencias(plan: PlanJson, porItem: Map<string, Tramo[]>, zona: string): Fila[] {
  const filas: Fila[] = []
  for (const item of plan.phases.flatMap((phase) => phase.items)) {
    const actuales = [...(item.work_log ?? [])]
    const propuestos = (porItem.get(item.id) ?? []).map((tramo) => aTramoPlan(tramo, zona))
    if (actuales.length === 0 && propuestos.length === 0) continue
    for (const p of propuestos) {
      const exacto = actuales.findIndex((a) => a.actor === p.actor && cerca(a.start, p.start) && cerca(a.end, p.end))
      const mismoActor = exacto >= 0 ? exacto : actuales.findIndex((a) => a.actor === p.actor && Date.parse(a.start) < Date.parse(p.end) && Date.parse(p.start) < Date.parse(a.end))
      const commits = p.commits.join(' ')
      if (mismoActor >= 0) {
        const [a] = actuales.splice(mismoActor, 1)
        filas.push({ item: item.id, actor: p.actor, actual: rango(a), propuesto: rango(p), estado: exacto >= 0 ? 'igual' : 'distinto', commits })
      } else {
        filas.push({ item: item.id, actor: p.actor, actual: '', propuesto: rango(p), estado: 'solo propuesto', commits })
      }
    }
    for (const a of actuales) {
      const estado = a.actor === 'orchestrator' ? 'manual (se conserva)' : 'solo en plan.json'
      filas.push({ item: item.id, actor: a.actor, actual: rango(a), propuesto: '', estado, commits: '' })
    }
  }
  return filas
}

export function tabla(filas: Fila[]): string {
  const cab = ['Item', 'Actor', 'plan.json', 'Propuesto', 'Estado', 'Commits (evidencia)']
  const datos = filas.map((f) => [f.item, f.actor, f.actual, f.propuesto, f.estado, f.commits])
  const anchos = cab.map((c, i) => Math.max(c.length, ...datos.map((d) => d[i].length)))
  const linea = (celdas: string[]) => celdas.map((c, i) => c.padEnd(anchos[i])).join(' | ').trimEnd()
  return [linea(cab), anchos.map((n) => '-'.repeat(n)).join('-|-'), ...datos.map(linea)].join('\n')
}
