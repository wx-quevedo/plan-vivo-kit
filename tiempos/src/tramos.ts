import { IDENTIFICADOR_POR_DEFECTO } from '../../configuracion.ts'
import type { SessionEvent, SubagentRun } from './jsonl'

export type Actor = 'orchestrator' | 'coding_agent' | 'subagent' | 'human'

export interface Tramo {
  actor: Actor
  start: number
  end: number
  note: string
  commits: string[]
}

export interface Commit {
  hash: string
  at: number
}

// Excepciones que la regla automática no resuelve (asignaciones.json, opcional).
// Claves de mensajes y esperas: marca de tiempo ISO (UTC) del mensaje humano, tal como aparece en el JSONL.
export interface Asignaciones {
  // Mensaje humano sin identificador que abre un item, o null: el mensaje no es de este plan (por ejemplo, de otro
  // proyecto cuya carpeta de sesiones también se lee). No abre nada y cierra el item abierto.
  mensajes: Record<string, string | null>
  // Subagente (id del archivo agent-<id>.jsonl) que trabajó para varios items.
  subagentes: Record<string, string[]>
  // Mensaje humano que cierra una espera por un pedido de acción (por ejemplo, un comando con sudo), con su motivo.
  esperas: Record<string, string>
}

export const SIN_ASIGNACIONES: Asignaciones = { mensajes: {}, subagentes: {}, esperas: {} }

export interface SinAsignar {
  at: number
  firstLine: string
  motivo: string
}

export interface Propuesta {
  porItem: Map<string, Tramo[]>
  sinAsignar: SinAsignar[]
  subagentesSinAsignar: SubagentRun[]
  commitsFuera: Commit[]
}

// Identificador al inicio de un prompt: "F1 · P4:", "F2 · U2:" o "F2 · P6b:". El primer grupo es el id del item.
// Se puede cambiar con la opción identificador de la configuración.
export const IDENTIFICADOR = new RegExp(IDENTIFICADOR_POR_DEFECTO)

const iso = (ms: number) => new Date(ms).toISOString()

interface Turno {
  at: number
  firstLine: string
  item: string | null
  porAsignacion: boolean
}

// Decide el item de cada mensaje humano: excepción del archivo, identificador, o item abierto.
function asignarTurnos(
  humanos: { at: number; firstLine: string }[],
  asignaciones: Asignaciones,
  items: Set<string>,
  identificador: RegExp,
  sinAsignar: SinAsignar[],
): Turno[] {
  let abierto: string | null = null
  return humanos.map((h) => {
    const excepcion = asignaciones.mensajes[iso(h.at)]
    const id = identificador.exec(h.firstLine)?.[1]
    let item: string | null = null
    if (excepcion === null) {
      abierto = null
    } else if (excepcion !== undefined) {
      if (items.has(excepcion)) item = excepcion
      else sinAsignar.push({ at: h.at, firstLine: h.firstLine, motivo: `asignaciones.json apunta a ${excepcion}, que no existe en plan.json` })
    } else if (id !== undefined) {
      if (items.has(id)) item = id
      else sinAsignar.push({ at: h.at, firstLine: h.firstLine, motivo: `el identificador ${id} no existe en plan.json` })
    } else if (abierto !== null) {
      item = abierto
    } else {
      sinAsignar.push({ at: h.at, firstLine: h.firstLine, motivo: 'sin identificador y sin item abierto' })
    }
    if (item !== null) abierto = item
    return { at: h.at, firstLine: h.firstLine, item, porAsignacion: excepcion !== undefined }
  })
}

export function proponer(input: {
  eventos: SessionEvent[]
  subagentes: SubagentRun[]
  commits: Commit[]
  asignaciones: Asignaciones
  items: Set<string>
  identificador?: RegExp
}): Propuesta {
  const { eventos, asignaciones, items } = input
  const sinAsignar: SinAsignar[] = []
  const humanos = eventos.filter((e): e is Extract<SessionEvent, { kind: 'human' }> => e.kind === 'human')
  const turnos = asignarTurnos(humanos, asignaciones, items, input.identificador ?? IDENTIFICADOR, sinAsignar)
  const porItem = new Map<string, Tramo[]>()
  const agregar = (item: string, tramo: Tramo) => {
    if (tramo.end <= tramo.start) return
    const lista = porItem.get(item) ?? []
    lista.push(tramo)
    porItem.set(item, lista)
  }

  turnos.forEach((turno, i) => {
    const siguiente = turnos[i + 1]
    const hasta = siguiente?.at ?? Infinity
    if (turno.item === null) return
    const delTurno = eventos.filter((e) => e.kind !== 'human' && e.at > turno.at && e.at < hasta)
    const respuestas = new Map(delTurno.filter((e) => e.kind === 'answer').map((e) => [(e as { id: string }).id, e.at]))
    let cursor = turno.at
    let esperando: string | null = null

    for (const pregunta of delTurno.filter((e) => e.kind === 'question') as { at: number; id: string }[]) {
      agregar(turno.item, { actor: 'coding_agent', start: cursor, end: pregunta.at, note: '', commits: [] })
      const respuesta = respuestas.get(pregunta.id)
      if (respuesta !== undefined) {
        agregar(turno.item, { actor: 'human', start: pregunta.at, end: respuesta, note: 'espera: pregunta (AskUserQuestion)', commits: [] })
        cursor = respuesta
        esperando = null
      } else {
        // Pregunta sin respuesta formal: el agente terminó su turno esperando.
        cursor = pregunta.at
        esperando = 'espera: pregunta (AskUserQuestion) respondida con un mensaje'
      }
    }
    const ultimoAgente = Math.max(cursor, ...delTurno.filter((e) => e.kind === 'agent').map((e) => e.at))
    if (ultimoAgente > cursor) {
      agregar(turno.item, { actor: 'coding_agent', start: cursor, end: ultimoAgente, note: '', commits: [] })
      if (esperando !== null && delTurno.some((e) => e.kind === 'agent' && e.at > cursor)) esperando = null
    }

    // Hueco hasta el siguiente mensaje del mismo item: human solo con evidencia de que el agente esperaba algo.
    if (siguiente && siguiente.item === turno.item) {
      const pedido = asignaciones.esperas[iso(siguiente.at)]
      const senal = esperando ?? (pedido !== undefined ? `espera: pedido de acción (asignaciones.json: ${pedido})` : null)
      if (senal !== null) agregar(turno.item, { actor: 'human', start: Math.max(cursor, ultimoAgente), end: siguiente.at, note: senal, commits: [] })
    }
  })

  // Subagentes: pertenecen al item abierto cuando se lanzaron, salvo excepción del archivo.
  const subagentesSinAsignar: SubagentRun[] = []
  for (const run of input.subagentes) {
    const excepcion = asignaciones.subagentes[run.id]
    const abierto = [...turnos].reverse().find((t) => t.at <= run.start && t.item !== null)?.item ?? null
    const destino = excepcion ?? (abierto !== null ? [abierto] : [])
    if (destino.length === 0) subagentesSinAsignar.push(run)
    const nota = `subagente ${run.id.slice(0, 8)}${excepcion ? ' (asignaciones.json)' : ''}`
    for (const item of destino) if (items.has(item)) agregar(item, { actor: 'subagent', start: run.start, end: run.end, note: nota, commits: [] })
  }

  for (const lista of porItem.values()) lista.sort((a, b) => a.start - b.start || a.actor.localeCompare(b.actor))

  // Evidencia: cada commit va al tramo del agente de código que lo contiene; si no hay, a cualquier tramo que lo contenga.
  const todos = [...porItem.values()].flat()
  const commitsFuera: Commit[] = []
  for (const commit of [...input.commits].sort((a, b) => a.at - b.at)) {
    const contiene = todos.filter((t) => t.start <= commit.at && commit.at <= t.end)
    const destino = contiene.find((t) => t.actor === 'coding_agent') ?? contiene[0]
    if (destino) destino.commits.push(commit.hash)
    else commitsFuera.push(commit)
  }

  return { porItem, sinAsignar, subagentesSinAsignar, commitsFuera }
}
