import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FormatError, readSession, readSubagent } from '../src/jsonl'
import { proponer, SIN_ASIGNACIONES, type Asignaciones, type Commit } from '../src/tramos'
import { aplicar, aTramoPlan, type PlanJson } from '../src/plan'
import { diferencias } from '../src/diferencias'

// Registros JSONL sintéticos escritos a mano: solo tipos, marcas de tiempo y textos de relleno.
const Z = (hm: string) => `2026-10-11T${hm}:00.000Z`
const ms = (hm: string) => Date.parse(Z(hm))
const humano = (hm: string, texto: string) => ({ type: 'user', timestamp: Z(hm), origin: { kind: 'human' }, message: { content: texto } })
const agente = (hm: string) => ({ type: 'assistant', timestamp: Z(hm), message: { content: [{ type: 'text', text: 'relleno' }] } })
const pregunta = (hm: string, id: string) => ({ type: 'assistant', timestamp: Z(hm), message: { content: [{ type: 'tool_use', name: 'AskUserQuestion', id }] } })
const respuesta = (hm: string, id: string) => ({ type: 'user', timestamp: Z(hm), message: { content: [{ type: 'tool_result', tool_use_id: id }] } })

const dir = () => mkdtempSync(join(tmpdir(), 'tiempos-'))
function jsonl(nombre: string, registros: object[], carpeta = dir()): string {
  const ruta = join(carpeta, nombre)
  writeFileSync(ruta, registros.map((r) => JSON.stringify(r)).join('\n') + '\n')
  return ruta
}

const ITEMS = new Set(['P4', 'U2'])
const SIN_EXCEPCIONES: Asignaciones = SIN_ASIGNACIONES
const ZONA = 'America/Guayaquil'

function proponerDe(registros: object[], extra: { asignaciones?: Asignaciones; commits?: Commit[]; subagentes?: { id: string; start: number; end: number }[] } = {}) {
  return proponer({
    eventos: readSession(jsonl('sesion.jsonl', registros)),
    subagentes: extra.subagentes ?? [],
    commits: extra.commits ?? [],
    asignaciones: extra.asignaciones ?? SIN_EXCEPCIONES,
    items: ITEMS,
  })
}

const resumen = (tramos: { actor: string; start: number; end: number }[] | undefined) =>
  (tramos ?? []).map((t) => [t.actor, new Date(t.start).toISOString().slice(11, 16), new Date(t.end).toISOString().slice(11, 16)])

describe('asignación a items', () => {
  it('asignación por identificador: cada mensaje "F1 · X:" abre su item', () => {
    const p = proponerDe([humano('10:00', 'F1 · P4: algo'), agente('10:05'), humano('10:30', 'F1 · U2: otra cosa'), agente('10:40')])
    expect(resumen(p.porItem.get('P4'))).toEqual([['coding_agent', '10:00', '10:05']])
    expect(resumen(p.porItem.get('U2'))).toEqual([['coding_agent', '10:30', '10:40']])
  })

  it('mensaje sin identificador pertenece al item abierto; el hueco queda en espera, sin actor', () => {
    const p = proponerDe([humano('10:00', 'F1 · P4: algo'), agente('10:05'), humano('10:20', 'Corrige esto'), agente('10:25')])
    expect(resumen(p.porItem.get('P4'))).toEqual([
      ['coding_agent', '10:00', '10:05'],
      ['coding_agent', '10:20', '10:25'],
    ])
  })

  it('mensaje sin item asignable: se reporta y no se asigna', () => {
    const p = proponerDe([humano('09:00', 'Hola'), agente('09:05')])
    expect(p.porItem.size).toBe(0)
    expect(p.sinAsignar).toEqual([{ at: ms('09:00'), firstLine: 'Hola', motivo: 'sin identificador y sin item abierto' }])
  })

  it('asignaciones.json corrige un mensaje sin identificador que abre otro item', () => {
    const p = proponerDe([humano('10:00', 'F1 · P4: algo'), agente('10:05'), humano('10:20', 'Reemplaza esto'), agente('10:25')], {
      asignaciones: { ...SIN_EXCEPCIONES, mensajes: { [Z('10:20')]: 'U2' } },
    })
    expect(resumen(p.porItem.get('U2'))).toEqual([['coding_agent', '10:20', '10:25']])
    expect(resumen(p.porItem.get('P4'))).toEqual([['coding_agent', '10:00', '10:05']])
  })
})

describe('tramos', () => {
  it('espera por pregunta: AskUserQuestion abre un tramo human hasta la respuesta', () => {
    const p = proponerDe([humano('10:00', 'F1 · P4: algo'), agente('10:01'), pregunta('10:02', 'q1'), respuesta('10:07', 'q1'), agente('10:20')])
    expect(resumen(p.porItem.get('P4'))).toEqual([
      ['coding_agent', '10:00', '10:02'],
      ['human', '10:02', '10:07'],
      ['coding_agent', '10:07', '10:20'],
    ])
    expect(p.porItem.get('P4')![1].note).toBe('espera: pregunta (AskUserQuestion)')
  })

  it('pedido de acción registrado en asignaciones.json: la espera entre turnos es human', () => {
    const p = proponerDe([humano('10:00', 'F1 · P4: algo'), agente('10:10'), humano('10:30', 'Listo'), agente('10:35')], {
      asignaciones: { ...SIN_EXCEPCIONES, esperas: { [Z('10:30')]: 'comando con sudo' } },
    })
    const tramos = p.porItem.get('P4')!
    expect(resumen(tramos)).toEqual([
      ['coding_agent', '10:00', '10:10'],
      ['human', '10:10', '10:30'],
      ['coding_agent', '10:30', '10:35'],
    ])
    expect(tramos[1].note).toBe('espera: pedido de acción (asignaciones.json: comando con sudo)')
  })

  it('subagente solapado: pertenece al item abierto cuando se lanzó', () => {
    const p = proponerDe([humano('10:00', 'F1 · P4: algo'), agente('10:30'), humano('11:00', 'F1 · U2: otra'), agente('11:10')], {
      subagentes: [{ id: 'abc12345def', start: ms('10:05'), end: ms('10:20') }],
    })
    expect(resumen(p.porItem.get('P4'))).toEqual([
      ['coding_agent', '10:00', '10:30'],
      ['subagent', '10:05', '10:20'],
    ])
    expect(resumen(p.porItem.get('U2'))).toEqual([['coding_agent', '11:00', '11:10']])
  })

  it('subagente compartido: asignaciones.json lo reparte a varios items', () => {
    const p = proponerDe([humano('10:00', 'F1 · P4: algo'), agente('10:30')], {
      subagentes: [{ id: 'abc12345def', start: ms('10:05'), end: ms('10:20') }],
      asignaciones: { ...SIN_EXCEPCIONES, subagentes: { abc12345def: ['U2', 'P4'] } },
    })
    expect(resumen(p.porItem.get('U2'))).toEqual([['subagent', '10:05', '10:20']])
    expect(p.porItem.get('P4')!.map((t) => t.actor)).toEqual(['coding_agent', 'subagent'])
  })

  it('commit dentro de un tramo se adjunta como evidencia; fuera de todo tramo se reporta', () => {
    const p = proponerDe([humano('10:00', 'F1 · P4: algo'), agente('10:30')], {
      commits: [
        { hash: 'aaa1111', at: ms('10:10') },
        { hash: 'bbb2222', at: ms('11:00') },
      ],
    })
    expect(p.porItem.get('P4')![0].commits).toEqual(['aaa1111'])
    expect(p.commitsFuera.map((c) => c.hash)).toEqual(['bbb2222'])
  })
})

describe('formato del JSONL', () => {
  it('formato con campo faltante: falla y dice qué campo falta', () => {
    const ruta = jsonl('sesion.jsonl', [humano('10:00', 'F1 · P4: algo'), { type: 'assistant', message: { content: [] } }])
    expect(() => readSession(ruta)).toThrow(new FormatError(ruta, 2, 'falta el campo timestamp en un registro assistant'))
  })

  it('sin el campo origin en ningún registro user: falla en vez de adivinar quién escribió', () => {
    const ruta = jsonl('sesion.jsonl', [{ type: 'user', timestamp: Z('10:00'), message: { content: 'F1 · P4: algo' } }, agente('10:05')])
    expect(() => readSession(ruta)).toThrow(/ningún registro user tiene el campo origin/)
  })

  it('subagente: primer y último evento de su registro', () => {
    const ruta = jsonl('agent-abc12345def.jsonl', [{ ...agente('10:05'), isSidechain: true }, { ...agente('10:20'), isSidechain: true }])
    expect(readSubagent(ruta)).toEqual({ id: 'abc12345def', start: ms('10:05'), end: ms('10:20') })
  })
})

describe('aplicar en plan.json', () => {
  const planMinimo = (status = 'in_progress') => ({
    schema: 1,
    project: 'prueba',
    title: 'Prueba',
    updated_at: '2026-10-11T10:00:00-05:00',
    phases: [
      {
        id: 'F1',
        name: 'Base',
        items: [{ id: 'P4', type: 'prompt', title: 'x', status, work_log: [], summary: '', steps: [], files_changed: 0, notes: '' }],
      },
    ],
  })

  it('idempotencia: aplicar dos veces deja el mismo archivo', () => {
    const ruta = join(dir(), 'plan.json')
    writeFileSync(ruta, JSON.stringify(planMinimo()))
    const p = proponerDe([humano('10:00', 'F1 · P4: algo'), agente('10:30')], { commits: [{ hash: 'aaa1111', at: ms('10:10') }] })
    expect(aplicar(ruta, p.porItem, ZONA).cambiados).toEqual(['P4'])
    const primera = readFileSync(ruta, 'utf8')
    expect(aplicar(ruta, p.porItem, ZONA).cambiados).toEqual([])
    expect(readFileSync(ruta, 'utf8')).toBe(primera)
    expect(JSON.parse(primera).phases[0].items[0].work_log).toEqual([
      { actor: 'coding_agent', start: '2026-10-11T05:00:00-05:00', end: '2026-10-11T05:30:00-05:00', note: '', commits: ['aaa1111'] },
    ])
  })

  it('si el plan no valida el esquema, no escribe nada', () => {
    const ruta = join(dir(), 'plan.json')
    const original = JSON.stringify(planMinimo('terminado'))
    writeFileSync(ruta, original)
    const p = proponerDe([humano('10:00', 'F1 · P4: algo'), agente('10:30')])
    expect(() => aplicar(ruta, p.porItem, ZONA)).toThrow(/no valida el esquema/)
    expect(readFileSync(ruta, 'utf8')).toBe(original)
  })

  it('tabla de diferencias: igual, distinto, solo propuesto y solo en plan.json', () => {
    const p = proponerDe([humano('10:00', 'F1 · P4: algo'), agente('10:30'), humano('11:00', 'F1 · U2: otra'), agente('11:10')])
    const [igual] = p.porItem.get('P4')!.map((t) => aTramoPlan(t, ZONA))
    const plan = {
      phases: [
        {
          id: 'F1',
          items: [
            { id: 'P4', work_log: [igual, { actor: 'human', start: '2026-10-11T04:00:00-05:00', end: '2026-10-11T04:10:00-05:00', note: '', commits: [] }] },
            { id: 'U2', work_log: [{ ...aTramoPlan(p.porItem.get('U2')![0], ZONA), end: '2026-10-11T06:20:00-05:00' }] },
          ],
        },
      ],
    } as PlanJson
    expect(diferencias(plan, p.porItem, ZONA).map((f) => [f.item, f.actor, f.estado])).toEqual([
      ['P4', 'coding_agent', 'igual'],
      ['P4', 'human', 'solo en plan.json'],
      ['U2', 'coding_agent', 'distinto'],
    ])
  })
})
