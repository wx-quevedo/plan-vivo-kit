// Migraciones del formato de plan.json (decisión K3). Cada una lleva un plan de su versión a la siguiente.
// Un plan sin schema_version es de la versión 0. Las migraciones no validan: lo hace quien las usa (pnpm migrar).
import { VERSION_ESQUEMA } from './schema'

type PlanCrudo = Record<string, unknown>

interface Migracion {
  hasta: number
  // Cambia el plan en el lugar y devuelve una línea por cambio, para mostrarla antes de aplicar.
  aplicar: (plan: PlanCrudo) => string[]
}

// Inserta una clave en una posición, conservando el orden de las demás (el orden se ve en el archivo).
function conClaveEn(plan: PlanCrudo, posicion: number, clave: string, valor: unknown): PlanCrudo {
  const entradas = Object.entries(plan).filter(([k]) => k !== clave)
  entradas.splice(posicion, 0, [clave, valor])
  return Object.fromEntries(entradas)
}

function reemplazar(plan: PlanCrudo, nuevo: PlanCrudo): void {
  for (const clave of Object.keys(plan)) delete plan[clave]
  Object.assign(plan, nuevo)
}

const MIGRACIONES: Migracion[] = [
  {
    // 0 -> 1: la versión pasa a schema_version, después de $schema. El campo anterior "schema" se quita.
    hasta: 1,
    aplicar(plan) {
      const cambios = ['+ schema_version: 1']
      const posicion = Math.max(0, Object.keys(plan).indexOf('$schema') + 1)
      if ('schema' in plan) {
        cambios.push(`- schema: ${JSON.stringify(plan.schema)} (lo reemplaza schema_version)`)
        delete plan.schema
      }
      reemplazar(plan, conClaveEn(plan, posicion, 'schema_version', 1))
      return cambios
    },
  },
]

export class ErrorDeMigracion extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorDeMigracion'
  }
}

export function versionDe(plan: unknown): number {
  if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) throw new ErrorDeMigracion('plan.json debe ser un objeto JSON')
  const version = (plan as PlanCrudo).schema_version
  if (version === undefined) return 0
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ErrorDeMigracion(`schema_version no válido: ${JSON.stringify(version)} (debe ser un entero desde 1)`)
  }
  return version
}

export interface ResultadoDeMigracion {
  plan: PlanCrudo
  desde: number
  hasta: number
  // Una línea por cambio, agrupadas por migración. Vacío si el plan ya estaba en la versión actual.
  cambios: { hasta: number; lineas: string[] }[]
}

// Lleva el plan a la versión actual sin modificar el original.
export function migrar(original: unknown, actual = VERSION_ESQUEMA): ResultadoDeMigracion {
  const desde = versionDe(original)
  if (desde > actual) {
    throw new ErrorDeMigracion(`El plan es de la versión ${desde} del formato y este kit llega a la ${actual}: actualiza el kit.`)
  }
  const plan = structuredClone(original) as PlanCrudo
  const cambios: ResultadoDeMigracion['cambios'] = []
  for (let version = desde; version < actual; version++) {
    const migracion = MIGRACIONES.find((m) => m.hasta === version + 1)
    if (!migracion) throw new ErrorDeMigracion(`Falta la migración de la versión ${version} a la ${version + 1}`)
    cambios.push({ hasta: migracion.hasta, lineas: migracion.aplicar(plan) })
  }
  return { plan, desde, hasta: actual, cambios }
}
