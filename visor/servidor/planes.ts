// Planes que muestra un visor. Un solo visor (puerto 5190) sirve los planes de varios proyectos: cada uno tiene un id
// corto para su dirección (http://localhost:5190/?plan=<id>). La lista vive en memoria mientras el visor está abierto.
import { existsSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, resolve } from 'node:path'

export interface PlanDelVisor {
  id: string
  ruta: string
}

const slug = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'plan'

// Id a partir de la ruta: la carpeta del proyecto para un plan.json (C:\proyectos\mi-proyecto\plan.json queda
// como mi-proyecto); con otro nombre de archivo, carpeta y archivo (ejemplos/plan-inicial.json: ejemplos-plan-inicial).
export function idPara(ruta: string): string {
  const archivo = basename(ruta, extname(ruta))
  const carpeta = basename(dirname(ruta))
  return slug(archivo === 'plan' ? carpeta : `${carpeta}-${archivo}`)
}

// En Windows y en la Mac el sistema de archivos no distingue mayúsculas.
const mismaRuta = (a: string, b: string) => (process.platform === 'linux' ? a === b : a.toLowerCase() === b.toLowerCase())

export class ErrorDePlan extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorDePlan'
  }
}

// Revisa una ruta que llega para agregarse: absoluta, de un .json que existe.
export function comprobarRuta(ruta: unknown): string {
  if (typeof ruta !== 'string' || ruta === '') throw new ErrorDePlan('Falta la ruta del plan')
  if (!isAbsolute(ruta)) throw new ErrorDePlan(`La ruta del plan debe ser absoluta: ${ruta}`)
  const absoluta = resolve(ruta)
  if (extname(absoluta).toLowerCase() !== '.json') throw new ErrorDePlan(`El plan debe ser un archivo .json: ${absoluta}`)
  if (!existsSync(absoluta)) throw new ErrorDePlan(`No existe el plan: ${absoluta}`)
  return absoluta
}

export class PlanesDelVisor {
  private planes: PlanDelVisor[] = []

  // Agrega un plan; si ya estaba (la misma ruta), devuelve el que había. Dos proyectos con la misma carpeta final
  // reciben ids distintos (mi-proyecto y mi-proyecto-2).
  agregar(ruta: string): { plan: PlanDelVisor; nuevo: boolean } {
    const absoluta = resolve(ruta)
    const existente = this.planes.find((p) => mismaRuta(p.ruta, absoluta))
    if (existente) return { plan: existente, nuevo: false }
    const base = idPara(absoluta)
    let id = base
    for (let n = 2; this.planes.some((p) => p.id === id); n++) id = `${base}-${n}`
    const plan = { id, ruta: absoluta }
    this.planes.push(plan)
    return { plan, nuevo: true }
  }

  lista(): PlanDelVisor[] {
    return this.planes.map((p) => ({ ...p }))
  }

  // Sin id, el primero (el que se abrió al levantar el visor).
  buscar(id?: string | null): PlanDelVisor | undefined {
    return id ? this.planes.find((p) => p.id === id) : this.planes[0]
  }
}
