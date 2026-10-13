// Lo que cambió al sacar el script de server-monitor: zona horaria, identificador, asignaciones opcionales y rutas.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readSession } from '../src/jsonl'
import { proponer, SIN_ASIGNACIONES } from '../src/tramos'
import { aplicar } from '../src/plan'
import { carpetaDeSesiones, leerAsignaciones, nombreDeCarpeta } from '../src/fuentes'
import { diferencias } from '../src/diferencias'

const Z = (hm: string) => `2026-10-11T${hm}:00.000Z`
const humano = (hm: string, texto: string) => ({ type: 'user', timestamp: Z(hm), origin: { kind: 'human' }, message: { content: texto } })
const agente = (hm: string) => ({ type: 'assistant', timestamp: Z(hm), message: { content: [{ type: 'text', text: 'relleno' }] } })
const dir = () => mkdtempSync(join(tmpdir(), 'tiempos-'))

function eventos(registros: object[]) {
  const ruta = join(dir(), 'sesion.jsonl')
  writeFileSync(ruta, registros.map((r) => JSON.stringify(r)).join('\n') + '\n')
  return readSession(ruta)
}

const proponerCon = (registros: object[], items: string[], identificador?: RegExp) =>
  proponer({ eventos: eventos(registros), subagentes: [], commits: [], asignaciones: SIN_ASIGNACIONES, items: new Set(items), identificador })

describe('identificador de item', () => {
  it('reconoce ids con letra final y prefijos de fase de varias letras: "F2 · P6b:" y "QA1 · T3:"', () => {
    const p = proponerCon([humano('10:00', 'F2 · P6b: algo'), agente('10:10'), humano('11:00', 'QA1 · T3: otra'), agente('11:05')], ['P6b', 'T3'])
    expect(p.sinAsignar).toEqual([])
    expect([...p.porItem.keys()]).toEqual(['P6b', 'T3'])
  })

  it('la fase también puede llevar una letra final: "M6b · P2:"', () => {
    const p = proponerCon([humano('10:00', 'M6b · P2: algo'), agente('10:10'), humano('11:00', 'M6b: sin item'), agente('11:05')], ['P2'])
    expect([...p.porItem.keys()]).toEqual(['P2'])
    expect(p.porItem.get('P2')).toHaveLength(2)
  })

  it('un "Nota:" o una hora "10:30" al inicio no abren ningún item', () => {
    const p = proponerCon([humano('10:00', 'F1 · P1: algo'), agente('10:10'), humano('10:20', 'Nota: a las 10:30 reviso'), agente('10:25')], ['P1'])
    expect(p.sinAsignar).toEqual([])
    expect(p.porItem.get('P1')).toHaveLength(2)
  })

  it('acepta una expresión propia (por ejemplo "[T-12]")', () => {
    const p = proponerCon([humano('10:00', '[T-12] arreglar el login'), agente('10:10')], ['T-12'], /^\[(T-\d+)\]/)
    expect(p.porItem.get('T-12')).toHaveLength(1)
  })
})

describe('asignaciones.json opcional', () => {
  it('sin archivo: ninguna excepción', () => {
    expect(leerAsignaciones(join(dir(), 'no-existe.json'))).toEqual(SIN_ASIGNACIONES)
  })

  it('con solo uno de los campos: los otros quedan vacíos', () => {
    const ruta = join(dir(), 'asignaciones.json')
    writeFileSync(ruta, JSON.stringify({ esperas: { [Z('10:30')]: 'comando con sudo' } }))
    expect(leerAsignaciones(ruta)).toEqual({ mensajes: {}, subagentes: {}, esperas: { [Z('10:30')]: 'comando con sudo' } })
  })

  it('con un campo de tipo incorrecto: falla y dice cuál', () => {
    const ruta = join(dir(), 'asignaciones.json')
    writeFileSync(ruta, JSON.stringify({ mensajes: { [Z('10:30')]: 7 } }))
    expect(() => leerAsignaciones(ruta)).toThrow(/mensajes\.2026-10-11T10:30:00\.000Z debe ser un texto/)
  })
})

describe('zona horaria al escribir plan.json', () => {
  it('escribe los tramos en la hora local de la zona configurada, con su desfase', () => {
    const ruta = join(dir(), 'plan.json')
    const plan = {
      schema: 1,
      project: 'prueba',
      title: 'Prueba',
      updated_at: '2026-10-11T10:00:00+02:00',
      phases: [{ id: 'A', name: 'Base', items: [{ id: 'P1', type: 'prompt', title: 'x', status: 'in_progress' }] }],
    }
    writeFileSync(ruta, JSON.stringify(plan))
    const p = proponerCon([humano('10:00', 'A1 · P1: algo'), agente('10:30')], ['P1'])
    aplicar(ruta, p.porItem, 'Europe/Madrid')
    const tramo = JSON.parse(readFileSync(ruta, 'utf8')).phases[0].items[0].work_log[0]
    expect([tramo.start, tramo.end]).toEqual(['2026-10-11T12:00:00+02:00', '2026-10-11T12:30:00+02:00'])
  })
})

describe('tramos del orquestador cargados a mano', () => {
  it('--aplicar los conserva y los ordena con los propuestos; la tabla los marca como manuales', () => {
    const ruta = join(dir(), 'plan.json')
    const orquestador = { actor: 'orchestrator', start: '2026-10-11T04:50:00-05:00', end: '2026-10-11T04:58:00-05:00', note: 'redacta el prompt', commits: [] }
    const plan = {
      schema: 1,
      project: 'prueba',
      title: 'Prueba',
      updated_at: '2026-10-11T10:00:00-05:00',
      phases: [{ id: 'F1', name: 'Base', items: [{ id: 'P1', type: 'prompt', title: 'x', status: 'in_progress', work_log: [orquestador] }] }],
    }
    writeFileSync(ruta, JSON.stringify(plan))
    const p = proponerCon([humano('10:00', 'F1 · P1: algo'), agente('10:30')], ['P1'])
    expect(diferencias(plan, p.porItem, 'America/Guayaquil').map((f) => [f.actor, f.estado])).toEqual([
      ['coding_agent', 'solo propuesto'],
      ['orchestrator', 'manual (se conserva)'],
    ])
    aplicar(ruta, p.porItem, 'America/Guayaquil')
    const log = JSON.parse(readFileSync(ruta, 'utf8')).phases[0].items[0].work_log
    expect(log.map((t: { actor: string; start: string }) => [t.actor, t.start])).toEqual([
      ['orchestrator', '2026-10-11T04:50:00-05:00'],
      ['coding_agent', '2026-10-11T05:00:00-05:00'],
    ])
  })
})

describe('carpeta de sesiones de Claude Code', () => {
  it('cada carácter que no es letra o número se cambia por un guion', () => {
    expect(nombreDeCarpeta('C:\\xampp\\htdocs\\server-monitor')).toBe('c--xampp-htdocs-server-monitor')
    expect(nombreDeCarpeta('C:/xampp/htdocs/server-monitor')).toBe('c--xampp-htdocs-server-monitor')
    expect(nombreDeCarpeta('/home/ana/mi_app.v2')).toBe('-home-ana-mi-app-v2')
  })

  it('la busca sin distinguir mayúsculas y, si no existe, pide --sesiones', () => {
    const base = dir()
    mkdirSync(join(base, 'C--Proyectos-app'))
    expect(carpetaDeSesiones('c:/proyectos/app', base)).toBe(join(base, 'C--Proyectos-app'))
    expect(() => carpetaDeSesiones('c:/otro', base)).toThrow(/usa --sesiones/)
  })
})

describe('mensajes excluidos (null en asignaciones.json)', () => {
  it('un mensaje de otro proyecto con un id que choca no abre ese item, y lo que sigue sin identificador queda sin asignar', () => {
    const asignaciones = { ...SIN_ASIGNACIONES, mensajes: { [Z('10:00')]: null } }
    const p = proponer({
      eventos: eventos([humano('10:00', 'F1 · P2: de otro proyecto'), agente('10:10'), humano('10:20', 'sigue sin id'), agente('10:30'), humano('11:00', 'F1 · P2: este sí'), agente('11:15')]),
      subagentes: [],
      commits: [],
      asignaciones,
      items: new Set(['P2']),
    })
    expect(p.porItem.get('P2')?.map((t) => [t.start, t.end])).toEqual([[Date.parse(Z('11:00')), Date.parse(Z('11:15'))]])
    expect(p.sinAsignar.map((s) => s.motivo)).toEqual(['sin identificador y sin item abierto'])
  })

  it('null también cierra el item que estaba abierto', () => {
    const asignaciones = { ...SIN_ASIGNACIONES, mensajes: { [Z('10:20')]: null } }
    const p = proponer({
      eventos: eventos([humano('10:00', 'F1 · P1: algo'), agente('10:10'), humano('10:20', 'otro proyecto'), agente('10:25'), humano('10:40', 'sin id'), agente('10:45')]),
      subagentes: [],
      commits: [],
      asignaciones,
      items: new Set(['P1']),
    })
    expect(p.porItem.get('P1')).toHaveLength(1)
    expect(p.sinAsignar).toHaveLength(1)
  })

  it('leerAsignaciones acepta null en mensajes y lo rechaza en esperas', () => {
    const ruta = join(dir(), 'asignaciones.json')
    writeFileSync(ruta, JSON.stringify({ mensajes: { [Z('10:00')]: null } }))
    expect(leerAsignaciones(ruta).mensajes).toEqual({ [Z('10:00')]: null })
    writeFileSync(ruta, JSON.stringify({ esperas: { [Z('10:00')]: null } }))
    expect(() => leerAsignaciones(ruta)).toThrow(/esperas\.2026-10-11T10:00:00\.000Z debe ser un texto$/)
  })
})

describe('bloques que agrega el entorno delante del mensaje', () => {
  const conBloques = (hm: string, bloques: string[]) => ({
    type: 'user',
    timestamp: Z(hm),
    origin: { kind: 'human' },
    message: { content: bloques.map((text) => ({ type: 'text', text })) },
  })
  const primera = (bloques: string[]) => {
    const [evento] = eventos([conBloques('10:00', bloques)])
    return evento.kind === 'human' ? evento.firstLine : null
  }

  it('Claude in Chrome en la extensión de VS Code: el identificador está dentro del prompt pegado, en otro bloque', () => {
    const bloques = [
      '<browser_instruction># Claude in Chrome\nInstrucciones largas\n</browser_instruction>',
      '\n<pasted_content id="834c">\nF1 · P1: Arranque\nresto\n</pasted_content id="834c">',
    ]
    expect(primera(bloques)).toBe('F1 · P1: Arranque')
    const p = proponer({
      eventos: eventos([conBloques('10:00', bloques), agente('10:20')]),
      subagentes: [],
      commits: [],
      asignaciones: SIN_ASIGNACIONES,
      items: new Set(['P1']),
    })
    expect(p.sinAsignar).toEqual([])
    expect(p.porItem.get('P1')).toHaveLength(1)
  })

  it('también en un solo bloque, con varios bloques seguidos o con el cierre en la misma línea', () => {
    expect(primera(['<system-reminder>a\nb</system-reminder>\n<ide_selection>x</ide_selection>\n\nF2 · P6b: algo'])).toBe('F2 · P6b: algo')
    expect(primera(['<ide_opened_file>archivo</ide_opened_file>F1 · P3: en la misma línea'])).toBe('F1 · P3: en la misma línea')
    expect(primera(['<pasted_content id="1">F1 · P4: pegado sin salto'])).toBe('F1 · P4: pegado sin salto')
  })

  it('un pegado vacío no oculta lo que sigue', () => {
    expect(primera(['<pasted_content id="1">\n</pasted_content id="1">\nF1 · P5: después'])).toBe('F1 · P5: después')
  })

  it('un mensaje sin bloques, o que empieza con otra etiqueta, queda igual que antes', () => {
    expect(primera(['F1 · P2: normal\nsegunda línea'])).toBe('F1 · P2: normal')
    expect(primera(['<div> no es del entorno'])).toBe('<div> no es del entorno')
    expect(primera(['\n\n  F1 · P2: con líneas vacías antes'])).toBe('  F1 · P2: con líneas vacías antes')
  })

  it('un bloque del entorno sin cierre no deja pasar nada de su contenido', () => {
    expect(primera(['<browser_instruction>\nF1 · P9: esto es del entorno'])).toBe('')
  })
})
