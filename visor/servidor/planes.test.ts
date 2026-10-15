import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { comprobarRuta, idPara, PlanesDelVisor } from './planes'

describe('ids de los planes del visor', () => {
  it('un plan.json toma el nombre de su carpeta; otro archivo, carpeta y archivo', () => {
    expect(idPara('C:\\xampp\\htdocs\\mi-proyecto\\plan.json')).toBe('mi-proyecto')
    expect(idPara('C:/xampp/htdocs/plan-vivo/ejemplos/plan-inicial.json')).toBe('ejemplos-plan-inicial')
    expect(idPara('/home/ana/Mi Proyecto_2/plan.json')).toBe('mi-proyecto-2')
    expect(idPara('/home/ana/Tráfico/plan.json')).toBe('trafico')
  })

  it('el mismo plan no se repite; dos carpetas con el mismo nombre reciben ids distintos', () => {
    const planes = new PlanesDelVisor()
    expect(planes.agregar('C:/a/mi-proyecto/plan.json')).toEqual({ plan: { id: 'mi-proyecto', ruta: join('C:/a/mi-proyecto/plan.json') }, nuevo: true })
    expect(planes.agregar('C:/a/mi-proyecto/plan.json').nuevo).toBe(false)
    expect(planes.agregar('C:/b/mi-proyecto/plan.json').plan.id).toBe('mi-proyecto-2')
    expect(planes.agregar('C:/c/mi-proyecto/plan.json').plan.id).toBe('mi-proyecto-3')
    expect(planes.lista().map((p) => p.id)).toEqual(['mi-proyecto', 'mi-proyecto-2', 'mi-proyecto-3'])
  })

  it.runIf(process.platform !== 'linux')('en Windows y en la Mac, la misma ruta con otras mayúsculas es el mismo plan', () => {
    const planes = new PlanesDelVisor()
    planes.agregar('C:/A/proyecto/plan.json')
    expect(planes.agregar('c:/a/PROYECTO/plan.json').nuevo).toBe(false)
  })

  it('sin id, el primero; con un id que no está, ninguno', () => {
    const planes = new PlanesDelVisor()
    planes.agregar('C:/a/uno/plan.json')
    planes.agregar('C:/a/dos/plan.json')
    expect(planes.buscar()?.id).toBe('uno')
    expect(planes.buscar('dos')?.id).toBe('dos')
    expect(planes.buscar('tres')).toBeUndefined()
  })

  it('la lista es una copia: quien la recibe no cambia el registro', () => {
    const planes = new PlanesDelVisor()
    planes.agregar('C:/a/uno/plan.json')
    planes.lista()[0].id = 'otro'
    expect(planes.buscar('uno')).toBeDefined()
  })
})

describe('rutas que llegan para sumarse al visor', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'planes-'))
  mkdirSync(join(carpeta, 'proyecto'))
  const plan = join(carpeta, 'proyecto', 'plan.json')
  writeFileSync(plan, '{}')
  writeFileSync(join(carpeta, 'notas.txt'), '')

  it('acepta una ruta absoluta a un .json que existe', () => {
    expect(comprobarRuta(plan)).toBe(plan)
  })

  it('rechaza con un mensaje claro: sin ruta, relativa, que no es .json o que no existe', () => {
    expect(() => comprobarRuta(undefined)).toThrow('Falta la ruta del plan')
    expect(() => comprobarRuta('proyecto/plan.json')).toThrow('La ruta del plan debe ser absoluta')
    expect(() => comprobarRuta(join(carpeta, 'notas.txt'))).toThrow('El plan debe ser un archivo .json')
    expect(() => comprobarRuta(join(carpeta, 'falta.json'))).toThrow(`No existe el plan: ${join(carpeta, 'falta.json')}`)
  })
})
