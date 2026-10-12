// Rutas por línea de comandos (decisión K1): el kit se corre desde su carpeta, o desde otra con pnpm --dir <kit>,
// apuntando al plan de cada proyecto. Prioridad: argumento, luego variable, luego plan-vivo.config.json, luego defecto.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exigirRuta, leerArgumentos, leerConfiguracion } from '../../configuracion.ts'
import { archivosDeSesiones, commitsDeGit } from '../src/fuentes'

const dir = () => mkdtempSync(join(tmpdir(), 'rutas-'))

function kit(config?: object): string {
  const raiz = dir()
  if (config) writeFileSync(join(raiz, 'plan-vivo.config.json'), JSON.stringify(config))
  return raiz
}

describe('argumentos', () => {
  it('ignora el "--" que deja pasar pnpm <comando> -- <argumentos>', () => {
    expect(leerArgumentos(['--', '--plan', 'p.json', '--aplicar'])).toEqual({ valores: { plan: 'p.json' }, config: undefined, resto: ['--aplicar'] })
  })

  it('--sesiones se puede repetir, también con la forma --sesiones=<carpeta>', () => {
    expect(leerArgumentos(['--sesiones', 'a', '--sesiones=b', '--sesiones', 'c']).valores.sesiones).toEqual(['a', 'b', 'c'])
  })

  it('los demás argumentos van una sola vez, y un valor vacío es un error', () => {
    expect(() => leerArgumentos(['--plan', 'a.json', '--plan', 'b.json'])).toThrow(/--plan se indicó más de una vez/)
    expect(() => leerArgumentos(['--config', 'a.json', '--config=b.json'])).toThrow(/--config se indicó más de una vez/)
    expect(() => leerArgumentos(['--asignaciones='])).toThrow(/Falta el valor de --asignaciones/)
  })
})

describe('prioridad de rutas: argumento, luego archivo, luego defecto', () => {
  const archivo = { plan: 'del-archivo/plan.json', sesiones: ['ses-a', 'ses-b'], asignaciones: 'del-archivo/asig.json' }

  it('sin argumentos ni archivo: valores por defecto', () => {
    const raiz = kit()
    const c = leerConfiguracion([], {}, { raiz })
    expect([c.plan, c.sesiones, c.asignaciones]).toEqual([join(raiz, 'plan.json'), null, join(raiz, 'asignaciones.json')])
    expect([c.origen.plan, c.origen.sesiones, c.origen.asignaciones]).toEqual(['defecto', 'defecto', 'defecto'])
  })

  it('con archivo: sus rutas, relativas a la carpeta del archivo; sesiones admite una lista', () => {
    const raiz = kit(archivo)
    const c = leerConfiguracion([], {}, { raiz })
    expect(c.plan).toBe(join(raiz, 'del-archivo', 'plan.json'))
    expect(c.sesiones).toEqual([join(raiz, 'ses-a'), join(raiz, 'ses-b')])
    expect(c.asignaciones).toBe(join(raiz, 'del-archivo', 'asig.json'))
    expect([c.origen.plan, c.origen.sesiones, c.origen.asignaciones]).toEqual(['archivo', 'archivo', 'archivo'])
    // Una sola carpeta como texto también vale.
    expect(leerConfiguracion([], {}, { raiz: kit({ sesiones: 'una' }) }).sesiones).toHaveLength(1)
  })

  it('el argumento gana al archivo; sus rutas relativas parten de la carpeta desde donde se llamó (INIT_CWD)', () => {
    const raiz = kit(archivo)
    const proyecto = dir()
    const c = leerConfiguracion(['--', '--plan', 'plan.json', '--sesiones', 'x', '--sesiones', 'C:/abs/y', '--asignaciones', 'a.json'], { INIT_CWD: proyecto }, { raiz })
    expect(c.plan).toBe(join(proyecto, 'plan.json'))
    expect(c.sesiones).toEqual([join(proyecto, 'x'), resolve('C:/abs/y')])
    expect(c.asignaciones).toBe(join(proyecto, 'a.json'))
    expect([c.origen.plan, c.origen.sesiones, c.origen.asignaciones]).toEqual(['argumento', 'argumento', 'argumento'])
  })

  it.runIf(process.platform === 'win32')('normaliza las barras invertidas duplicadas con que pnpm 11 pasa los argumentos en Windows', () => {
    const c = leerConfiguracion(['--plan', 'C:\\\\xampp\\\\htdocs\\\\otro\\\\plan.json', '--sesiones', 'D:\\\\s\\\\a'], {}, { raiz: kit() })
    expect([c.plan, c.sesiones]).toEqual(['C:\\xampp\\htdocs\\otro\\plan.json', ['D:\\s\\a']])
  })

  it('sin --asignaciones, asignaciones.json va junto al plan indicado con --plan, no junto al del archivo', () => {
    const proyecto = dir()
    const c = leerConfiguracion(['--plan', join(proyecto, 'plan.json')], {}, { raiz: kit({ plan: 'otro/plan.json' }) })
    expect(c.asignaciones).toBe(join(proyecto, 'asignaciones.json'))
  })

  it('PLAN_VIVO_SESIONES admite varias carpetas separadas por el separador del sistema', () => {
    const desde = dir()
    const c = leerConfiguracion([], { INIT_CWD: desde, PLAN_VIVO_SESIONES: ['a', 'b'].join(delimiter) }, { raiz: kit(archivo) })
    expect(c.sesiones).toEqual([join(desde, 'a'), join(desde, 'b')])
    expect(c.origen.sesiones).toBe('variable')
  })

  it('el archivo rechaza una lista de sesiones vacía o con algo que no sea texto', () => {
    expect(() => leerConfiguracion([], {}, { raiz: kit({ sesiones: [] }) })).toThrow(/sesiones tiene un tipo no válido/)
    expect(() => leerConfiguracion([], {}, { raiz: kit({ sesiones: ['a', 3] }) })).toThrow(/sesiones tiene un tipo no válido/)
    expect(() => leerConfiguracion([], {}, { raiz: kit({ sesiones: ['a', ''] }) })).toThrow(/sesiones tiene un tipo no válido/)
  })
})

describe('rutas que no existen', () => {
  it('el mensaje dice qué falta, la ruta, de dónde salió y cómo indicarla', () => {
    const proyecto = dir()
    const c = leerConfiguracion(['--plan', 'no-existe.json'], { INIT_CWD: proyecto }, { raiz: kit() })
    expect(() => exigirRuta(c, 'plan', c.plan)).toThrow(
      `No existe el plan: ${join(proyecto, 'no-existe.json')} (indicada con --plan). Indica la ruta con --plan <ruta absoluta> o en plan-vivo.config.json.`,
    )
    const raiz = kit({ plan: 'falta.json' })
    const deArchivo = leerConfiguracion([], {}, { raiz })
    expect(() => exigirRuta(deArchivo, 'plan', deArchivo.plan)).toThrow(`(indicada en ${join(raiz, 'plan-vivo.config.json')})`)
    const deVariable = leerConfiguracion([], { INIT_CWD: proyecto, PLAN_VIVO_PLAN: 'falta.json' }, { raiz: kit() })
    expect(() => exigirRuta(deVariable, 'plan', deVariable.plan)).toThrow('(indicada en una variable PLAN_VIVO_*)')
  })

  it('asignaciones.json es opcional solo cuando nadie indicó la ruta', () => {
    const proyecto = dir()
    const porDefecto = leerConfiguracion(['--plan', join(proyecto, 'plan.json')], {}, { raiz: kit() })
    expect(() => exigirRuta(porDefecto, 'asignaciones', porDefecto.asignaciones, { opcionalPorDefecto: true })).not.toThrow()
    const indicada = leerConfiguracion(['--asignaciones', join(proyecto, 'asig.json')], {}, { raiz: kit() })
    expect(() => exigirRuta(indicada, 'asignaciones', indicada.asignaciones, { opcionalPorDefecto: true })).toThrow(
      /No existe el archivo de asignaciones: .*asig\.json \(indicada con --asignaciones\)/,
    )
  })

  it('una ruta que existe no falla', () => {
    const proyecto = dir()
    writeFileSync(join(proyecto, 'plan.json'), '{}')
    const c = leerConfiguracion(['--plan', join(proyecto, 'plan.json')], {}, { raiz: kit() })
    expect(() => exigirRuta(c, 'plan', c.plan)).not.toThrow()
  })
})

describe('proyecto nuevo', () => {
  it('un repositorio git sin commits no tiene commits que asignar (git log fallaría)', () => {
    const repo = dir()
    execFileSync('git', ['init', '-q'], { cwd: repo })
    expect(() => commitsDeGit(repo)).not.toThrow()
    expect(commitsDeGit(repo)).toEqual([])
  })
})

describe('varias carpetas de sesiones', () => {
  function carpeta(sesiones: string[], subagentes: Record<string, string[]> = {}): string {
    const raiz = dir()
    for (const nombre of sesiones) writeFileSync(join(raiz, `${nombre}.jsonl`), '')
    for (const [sesion, ids] of Object.entries(subagentes)) {
      mkdirSync(join(raiz, sesion, 'subagents'), { recursive: true })
      for (const id of ids) writeFileSync(join(raiz, sesion, 'subagents', `agent-${id}.jsonl`), '')
    }
    return raiz
  }

  it('junta las sesiones y los subagentes de todas las carpetas', () => {
    const a = carpeta(['s1'], { s1: ['x'] })
    const b = carpeta(['s2', 's3'])
    const { sesiones, subagentes } = archivosDeSesiones([a, b])
    expect(sesiones.sort()).toEqual([join(a, 's1.jsonl'), join(b, 's2.jsonl'), join(b, 's3.jsonl')].sort())
    expect(subagentes).toEqual([join(a, 's1', 'subagents', 'agent-x.jsonl')])
  })

  it('una carpeta repetida, aunque se escriba distinto, se lee una sola vez', () => {
    const a = carpeta(['s1'])
    expect(archivosDeSesiones([a, a.toUpperCase(), join(a, '.')]).sesiones).toEqual([join(a, 's1.jsonl')])
  })
})
