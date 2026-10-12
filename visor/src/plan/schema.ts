import { z } from 'zod'

// Versión actual del formato de plan.json. Si cambia, se agrega su migración en migraciones.ts.
export const VERSION_ESQUEMA = 1

export const STATUSES = ['pending', 'in_progress', 'needs_you', 'done', 'problem'] as const
export const ITEM_TYPES = ['prompt', 'gate', 'unplanned'] as const

export const ACTORS = ['orchestrator', 'coding_agent', 'subagent', 'human'] as const

export type Status = (typeof STATUSES)[number]
export type ItemType = (typeof ITEM_TYPES)[number]
export type Actor = (typeof ACTORS)[number]

// Fecha ISO 8601 con zona explícita, por ejemplo 2026-10-11T08:09:00-05:00.
const isoDate = z.iso.datetime({ offset: true })

// Rango de minutos [mínimo, máximo].
const minutesRange = z
  .tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])
  .refine(([min, max]) => min <= max, { message: 'range_order' })

// Tramo de trabajo real. Las pausas no se guardan: son los huecos entre tramos (D20).
const workEntry = z
  .object({
    actor: z.enum(ACTORS),
    start: isoDate,
    end: isoDate,
    note: z.string().default(''),
    // Evidencia: commits hechos dentro del tramo (los asigna scripts/tiempos).
    commits: z.array(z.string()).default([]),
  })
  .strict()
  .refine((entry) => Date.parse(entry.end) > Date.parse(entry.start), { message: 'range_order', path: ['end'] })

// started_at, ended_at, real_min y commits no se guardan: se derivan de work_log (ver worklog.ts).
const itemSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(ITEM_TYPES),
    title: z.string().min(1),
    status: z.enum(STATUSES),
    estimate_min: minutesRange.nullable().optional(),
    difficulty: z.number().int().min(1).max(10).optional(),
    work_log: z.array(workEntry).default([]),
    summary: z.string().default(''),
    steps: z.array(z.string()).default([]),
    files_changed: z.number().int().nonnegative().default(0),
    notes: z.string().default(''),
  })
  .strict()

// La fase no tiene status: se deriva de sus items (ver derive.ts).
const phaseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    estimate_min: minutesRange.optional(),
    items: z.array(itemSchema),
  })
  .strict()

export const planSchema = z
  .object({
    // Ruta al JSON Schema (schema/plan.schema.json), para que el editor valide y complete el archivo.
    $schema: z.string().optional(),
    // Versión del formato (ver migraciones.ts). Opcional para que un plan sin migrar se siga viendo;
    // pnpm validar avisa si falta.
    schema_version: z.literal(VERSION_ESQUEMA).optional(),
    // Campo de la versión anterior a schema_version: la migración a la versión 1 lo quita.
    schema: z.literal(1).optional(),
    project: z.string().min(1),
    title: z.string().min(1),
    updated_at: isoDate,
    status_values: z.array(z.enum(STATUSES)).optional(),
    item_types: z.array(z.enum(ITEM_TYPES)).optional(),
    phases: z.array(phaseSchema).min(1),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const seen = new Set<string>()
    plan.phases.forEach((phase, p) => {
      phase.items.forEach((item, i) => {
        if (seen.has(item.id)) {
          ctx.addIssue({ code: 'custom', message: 'duplicate_id', path: ['phases', p, 'items', i, 'id'] })
        }
        seen.add(item.id)
      })
    })
  })

export type Plan = z.infer<typeof planSchema>
export type Phase = Plan['phases'][number]
export type Item = Phase['items'][number]

export type PlanIssueKind =
  | 'invalid_status'
  | 'invalid_item_type'
  | 'invalid_value'
  | 'missing'
  | 'wrong_type'
  | 'unknown_keys'
  | 'phase_status'
  | 'duplicate_id'
  | 'invalid_date'
  | 'range_order'
  | 'invalid'

// Error de validación independiente del idioma; la UI lo traduce con formatIssue.
export interface PlanIssue {
  kind: PlanIssueKind
  path: string
  where: string | null
  received?: string
  allowed?: string[]
  keys?: string[]
}

export type PlanResult = { ok: true; plan: Plan } | { ok: false; issues: PlanIssue[] }

type Key = PropertyKey

function valueAt(input: unknown, path: readonly Key[]): unknown {
  let current: unknown = input
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<Key, unknown>)[key]
  }
  return current
}

export function formatPath(path: readonly Key[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === 'number') return `${acc}[${key}]`
    return acc ? `${acc}.${String(key)}` : String(key)
  }, '')
}

// Identifica la fase o el item afectado (por ejemplo "F1 · P1") para que el error sea fácil de ubicar.
function locate(input: unknown, path: readonly Key[]): string | null {
  if (path[0] !== 'phases' || typeof path[1] !== 'number') return null
  const phaseId = valueAt(input, ['phases', path[1], 'id'])
  const parts: string[] = []
  if (typeof phaseId === 'string') parts.push(phaseId)
  if (path[2] === 'items' && typeof path[3] === 'number') {
    const itemId = valueAt(input, ['phases', path[1], 'items', path[3], 'id'])
    if (typeof itemId === 'string') parts.push(itemId)
  }
  return parts.length ? parts.join(' · ') : null
}

function show(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value) ?? String(value)
}

function toIssue(issue: z.core.$ZodIssue, input: unknown): PlanIssue {
  const path = issue.path
  const base = { path: formatPath(path), where: locate(input, path) }
  const last = path[path.length - 1]
  const received = valueAt(input, path)

  switch (issue.code) {
    case 'invalid_value': {
      const allowed = issue.values.map((v) => String(v))
      const kind: PlanIssueKind =
        last === 'status' ? 'invalid_status' : last === 'type' ? 'invalid_item_type' : 'invalid_value'
      return { ...base, kind, received: show(received), allowed }
    }
    case 'invalid_type':
      if (received === undefined) return { ...base, kind: 'missing' }
      return { ...base, kind: 'wrong_type', received: show(received), allowed: [issue.expected] }
    case 'unrecognized_keys': {
      const isPhase = path.length === 2 && path[0] === 'phases'
      if (isPhase && issue.keys.includes('status')) return { ...base, kind: 'phase_status' }
      return { ...base, kind: 'unknown_keys', keys: issue.keys }
    }
    case 'invalid_format':
      return { ...base, kind: 'invalid_date', received: show(received) }
    case 'custom':
      if (issue.message === 'duplicate_id') return { ...base, kind: 'duplicate_id', received: show(received) }
      if (issue.message === 'range_order') return { ...base, kind: 'range_order', received: show(received) }
      return { ...base, kind: 'invalid' }
    default:
      return { ...base, kind: 'invalid', received: show(received) }
  }
}

export function validatePlan(input: unknown): PlanResult {
  const result = planSchema.safeParse(input)
  if (result.success) return { ok: true, plan: result.data }
  return { ok: false, issues: result.error.issues.map((issue) => toIssue(issue, input)) }
}
