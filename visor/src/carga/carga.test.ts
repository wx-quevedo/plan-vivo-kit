import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { interpretar } from './Cargador'

const ejemplo = readFileSync(new URL('../../../ejemplos/plan.json', import.meta.url), 'utf8')

describe('carga de plan.json desde el servidor del visor', () => {
  it('archivo válido: se valida y queda listo para dibujar', () => {
    const carga = interpretar(200, ejemplo)
    expect(carga.estado).toBe('listo')
    if (carga.estado === 'listo') expect(carga.resultado.ok).toBe(true)
  })

  it('archivo que no cumple el esquema: listo, con los problemas para la vista de error', () => {
    const carga = interpretar(200, ejemplo.replace('"status": "done"', '"status": "terminado"'))
    expect(carga.estado).toBe('listo')
    if (carga.estado === 'listo') expect(carga.resultado.ok).toBe(false)
  })

  it('archivo que no existe (404): lo dice en vez de mostrar una página vacía', () => {
    expect(interpretar(404, '')).toEqual({ estado: 'no_existe' })
  })

  it('JSON roto (por ejemplo, a medio guardar): error con el detalle del intérprete', () => {
    const carga = interpretar(200, '{ "schema": 1, ')
    expect(carga.estado).toBe('json_invalido')
    if (carga.estado === 'json_invalido') expect(carga.detalle.length).toBeGreaterThan(0)
  })

  it('otra respuesta del servidor: sin servidor', () => {
    expect(interpretar(500, 'error')).toEqual({ estado: 'sin_servidor' })
  })
})
