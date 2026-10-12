import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { IDENTIFICADOR_POR_DEFECTO, leerConfiguracion } from '../../configuracion.ts'

const dir = () => mkdtempSync(join(tmpdir(), 'config-'))

// Una "raíz del kit" temporal, para no depender del plan-vivo.config.json real.
function kit(config?: object): string {
  const raiz = dir()
  if (config) writeFileSync(join(raiz, 'plan-vivo.config.json'), JSON.stringify(config))
  return raiz
}

describe('configuración del kit', () => {
  it('sin archivo ni argumentos: plan.json en la raíz del kit, puerto 5190 y hora de Guayaquil', () => {
    const raiz = kit()
    const c = leerConfiguracion([], {}, { raiz, cwd: raiz })
    expect(c).toMatchObject({
      plan: join(raiz, 'plan.json'),
      puerto: 5190,
      zonaHoraria: 'America/Guayaquil',
      repo: null,
      sesiones: null,
      asignaciones: join(raiz, 'asignaciones.json'),
      identificador: IDENTIFICADOR_POR_DEFECTO,
      archivo: null,
    })
  })

  it('el archivo resuelve sus rutas desde su propia carpeta (../plan.json = el plan del proyecto)', () => {
    const proyecto = dir()
    const raiz = join(proyecto, 'plan-vivo')
    mkdirSync(raiz)
    writeFileSync(join(raiz, 'plan-vivo.config.json'), JSON.stringify({ plan: '../plan.json', puerto: 5299, zonaHoraria: 'Europe/Madrid', sesiones: null }))
    const c = leerConfiguracion([], {}, { raiz, cwd: 'C:/otra/carpeta' })
    expect(c.plan).toBe(join(proyecto, 'plan.json'))
    expect(c.asignaciones).toBe(join(proyecto, 'asignaciones.json'))
    expect(c.puerto).toBe(5299)
    expect(c.zonaHoraria).toBe('Europe/Madrid')
  })

  it('los argumentos ganan a las variables, y las variables al archivo; las rutas de argumentos parten de INIT_CWD', () => {
    const raiz = kit({ plan: 'desde-archivo.json', puerto: 5201 })
    const desde = dir()
    const entorno = { INIT_CWD: desde, PLAN_VIVO_PLAN: 'desde-variable.json', PLAN_VIVO_PUERTO: '5202' }
    const soloEntorno = leerConfiguracion([], entorno, { raiz })
    expect([soloEntorno.plan, soloEntorno.puerto]).toEqual([join(desde, 'desde-variable.json'), 5202])
    const conArgumentos = leerConfiguracion(['--plan', 'desde-argumento.json', '--puerto=5203', '--aplicar'], entorno, { raiz })
    expect([conArgumentos.plan, conArgumentos.puerto, conArgumentos.resto]).toEqual([join(desde, 'desde-argumento.json'), 5203, ['--aplicar']])
  })

  it('--config usa otro archivo de configuración', () => {
    const otra = dir()
    writeFileSync(join(otra, 'mi.json'), JSON.stringify({ plan: 'p.json' }))
    const c = leerConfiguracion(['--config', join(otra, 'mi.json')], {}, { raiz: kit({ plan: 'no.json' }) })
    expect(c.plan).toBe(join(otra, 'p.json'))
  })

  it('errores claros: clave desconocida, puerto, zona, valor faltante y archivo inexistente', () => {
    expect(() => leerConfiguracion([], {}, { raiz: kit({ port: 1 }) })).toThrow(/claves no reconocidas: port/)
    expect(() => leerConfiguracion(['--puerto', 'abc'], {}, { raiz: kit() })).toThrow(/Puerto no válido: abc/)
    expect(() => leerConfiguracion(['--zona', 'Marte/Base'], {}, { raiz: kit() })).toThrow(/Zona horaria no válida/)
    expect(() => leerConfiguracion(['--plan'], {}, { raiz: kit() })).toThrow(/Falta el valor de --plan/)
    expect(() => leerConfiguracion(['--config', 'no-existe.json'], { INIT_CWD: dir() }, { raiz: kit() })).toThrow(/No existe el archivo de configuración/)
  })
})
