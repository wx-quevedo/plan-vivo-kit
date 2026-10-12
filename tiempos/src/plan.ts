import { readFileSync, writeFileSync } from 'node:fs'
import { validatePlan } from '../../visor/src/plan/schema.ts'
import { aLocal } from '../../visor/src/lib/zona.ts'
import type { Tramo } from './tramos'

// Las fechas de plan.json se escriben en la hora local de la zona configurada, con su desfase y precisión de segundos.

export interface TramoPlan {
  actor: string
  start: string
  end: string
  note: string
  commits: string[]
}

interface ItemPlan {
  id: string
  work_log?: TramoPlan[]
  commits?: unknown
  [clave: string]: unknown
}

export interface PlanJson {
  phases: { id: string; items: ItemPlan[] }[]
  [clave: string]: unknown
}

export function leerPlan(ruta: string): PlanJson {
  return JSON.parse(readFileSync(ruta, 'utf8')) as PlanJson
}

export function idsDeItems(plan: PlanJson): Set<string> {
  return new Set(plan.phases.flatMap((phase) => phase.items.map((item) => item.id)))
}

// Inicio y fin se redondean al segundo más cercano: los tramos contiguos siguen coincidiendo exactamente.
export function aTramoPlan(tramo: Tramo, zona: string): TramoPlan {
  return {
    actor: tramo.actor,
    start: aLocal(Math.round(tramo.start / 1000) * 1000, zona),
    end: aLocal(Math.round(tramo.end / 1000) * 1000, zona),
    note: tramo.note,
    commits: tramo.commits,
  }
}

// Mismo formato que el resto del archivo: 2 espacios, rangos y listas cortas en una línea.
export function serializar(plan: PlanJson): string {
  let out = JSON.stringify(plan, null, 2)
  out = out.replace(/\[\n\s+(-?\d+),\n\s+(-?\d+)\n\s+\]/g, '[$1, $2]')
  out = out.replace(/\{\n\s+"id": "([^"\n]+)",\n\s+"name": "([^"]+)",\n\s+"estimate_min": (\[\d+, \d+\]),\n\s+"items": \[\]\n\s+\}/g, '{ "id": "$1", "name": "$2", "estimate_min": $3, "items": [] }')
  out = out.replace(/\[\n((?:\s+"[^"\n]{1,12}",?\n)+)\s+\]/g, (_m, body: string) =>
    `[${body.trim().split(/,?\n\s+/).map((s) => s.replace(/,$/, '')).join(', ')}]`,
  )
  return `${out}\n`
}

// Reemplaza el work_log de los items con propuesta y valida con el esquema del visor.
// Si no valida, lanza un error y no escribe nada.
export function aplicar(ruta: string, porItem: Map<string, Tramo[]>, zona: string): { cambiados: string[] } {
  const plan = leerPlan(ruta)
  const cambiados: string[] = []
  for (const phase of plan.phases) {
    for (const item of phase.items) {
      const propuesta = porItem.get(item.id)
      if (!propuesta) continue
      // Los tramos del orquestador se cargan a mano (el script no ve sus sesiones): se conservan tal cual.
      const manuales = (item.work_log ?? []).filter((t) => t.actor === 'orchestrator')
      const nuevo = [...propuesta.map((tramo) => aTramoPlan(tramo, zona)).filter((t) => t.end > t.start), ...manuales].sort(
        (a, b) => Date.parse(a.start) - Date.parse(b.start) || a.actor.localeCompare(b.actor),
      )
      if (JSON.stringify(nuevo) !== JSON.stringify(item.work_log ?? [])) cambiados.push(item.id)
      item.work_log = nuevo
    }
  }
  const resultado = validatePlan(plan)
  if (!resultado.ok) {
    const detalle = resultado.issues.map((issue) => `${issue.kind} en ${issue.path}`).join('; ')
    throw new Error(`plan.json no valida el esquema después de aplicar; no se escribió nada (${detalle})`)
  }
  writeFileSync(ruta, serializar(plan))
  return { cambiados }
}
