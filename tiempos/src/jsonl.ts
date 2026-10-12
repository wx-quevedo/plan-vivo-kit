// Lectura de los registros JSONL de sesión de Claude Code, SOLO LECTURA.
// Privacidad: de cada registro se usan únicamente la marca de tiempo, el tipo de evento y, de los
// mensajes humanos, la PRIMERA línea (para identificar el item). Nada más se copia, guarda ni imprime.
// Para extraer esos campos hay que interpretar cada línea JSON en memoria; el resto se descarta.
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

export type SessionEvent =
  | { kind: 'human'; at: number; firstLine: string }
  | { kind: 'agent'; at: number }
  | { kind: 'question'; at: number; id: string }
  | { kind: 'answer'; at: number; id: string }

export interface SubagentRun {
  id: string
  start: number
  end: number
}

export class FormatError extends Error {
  constructor(file: string, line: number | null, message: string) {
    super(`${basename(file)}${line === null ? '' : `, línea ${line}`}: ${message}`)
    this.name = 'FormatError'
  }
}

type Json = Record<string, unknown>

function parseLines(file: string): { line: number; record: Json }[] {
  const text = readFileSync(file, 'utf8')
  return text
    .split('\n')
    .map((raw, index) => ({ raw, line: index + 1 }))
    .filter(({ raw }) => raw.trim().length > 0)
    .map(({ raw, line }) => {
      let record: unknown
      try {
        record = JSON.parse(raw)
      } catch {
        throw new FormatError(file, line, 'no es JSON válido')
      }
      if (record === null || typeof record !== 'object') throw new FormatError(file, line, 'el registro no es un objeto')
      if (typeof (record as Json).type !== 'string') throw new FormatError(file, line, 'falta el campo type')
      return { line, record: record as Json }
    })
}

function timestampOf(file: string, line: number, record: Json): number {
  if (typeof record.timestamp !== 'string') throw new FormatError(file, line, `falta el campo timestamp en un registro ${String(record.type)}`)
  const at = Date.parse(record.timestamp)
  if (Number.isNaN(at)) throw new FormatError(file, line, 'el campo timestamp no es una fecha válida')
  return at
}

function contentOf(file: string, line: number, record: Json): unknown[] {
  const message = record.message
  if (message === null || typeof message !== 'object' || !('content' in message)) {
    throw new FormatError(file, line, `falta el campo message.content en un registro ${String(record.type)}`)
  }
  const content = (message as Json).content
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  if (!Array.isArray(content)) throw new FormatError(file, line, 'message.content no es texto ni lista')
  return content
}

// Primera línea del primer bloque de texto; el resto del mensaje no se lee.
function firstLineOf(content: unknown[]): string {
  const block = content.find((b) => typeof b === 'object' && b !== null && (b as Json).type === 'text') as Json | undefined
  const text = typeof block?.text === 'string' ? block.text : ''
  return text.split('\n', 1)[0]
}

export function readSession(file: string): SessionEvent[] {
  const events: SessionEvent[] = []
  let userRecords = 0
  let withOrigin = 0
  for (const { line, record } of parseLines(file)) {
    if (record.isSidechain === true) continue
    if (record.type === 'assistant') {
      const at = timestampOf(file, line, record)
      events.push({ kind: 'agent', at })
      for (const block of contentOf(file, line, record)) {
        const b = block as Json
        if (b.type === 'tool_use' && b.name === 'AskUserQuestion') {
          if (typeof b.id !== 'string') throw new FormatError(file, line, 'falta el campo id en un tool_use de AskUserQuestion')
          events.push({ kind: 'question', at, id: b.id })
        }
      }
    } else if (record.type === 'user') {
      userRecords++
      const at = timestampOf(file, line, record)
      const content = contentOf(file, line, record)
      for (const block of content) {
        const b = block as Json
        if (b.type === 'tool_result' && typeof b.tool_use_id === 'string') events.push({ kind: 'answer', at, id: b.tool_use_id })
      }
      if (record.origin !== undefined) withOrigin++
      const origin = record.origin as Json | undefined
      if (origin?.kind === 'human') events.push({ kind: 'human', at, firstLine: firstLineOf(content) })
    }
  }
  // Sin el campo origin no se pueden distinguir los mensajes humanos de los resultados de herramientas.
  if (userRecords > 0 && withOrigin === 0) throw new FormatError(file, null, 'ningún registro user tiene el campo origin (¿cambió el formato?)')
  return events.sort((a, b) => a.at - b.at)
}

export function readSubagent(file: string): SubagentRun {
  const id = basename(file).replace(/^agent-/, '').replace(/\.jsonl$/, '')
  const times = parseLines(file)
    .filter(({ record }) => record.type === 'user' || record.type === 'assistant')
    .map(({ line, record }) => timestampOf(file, line, record))
  if (times.length === 0) throw new FormatError(file, null, 'el registro del subagente no tiene eventos user ni assistant')
  return { id, start: Math.min(...times), end: Math.max(...times) }
}
