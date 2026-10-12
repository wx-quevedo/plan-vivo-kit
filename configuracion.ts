// Configuración compartida del visor y del script de tiempos.
// Prioridad: argumentos de la línea de comandos > variables de entorno PLAN_VIVO_* > plan-vivo.config.json > valores por defecto.
// Las rutas de los argumentos y de las variables se resuelven desde la carpeta donde se ejecutó el comando
// (INIT_CWD, que pnpm conserva); las del archivo, desde la carpeta del archivo.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RAIZ_KIT = dirname(fileURLToPath(import.meta.url))
export const ARCHIVO_CONFIG = 'plan-vivo.config.json'
export const PUERTO_POR_DEFECTO = 5190
export const ZONA_POR_DEFECTO = 'America/Guayaquil'
// "F1 · P4:" abre el item P4. El primer grupo de captura es el id del item.
export const IDENTIFICADOR_POR_DEFECTO = '\\b[A-Z]+\\d+\\s*·\\s*([A-Za-z]+\\d+[a-z]?)\\s*:'

export interface Configuracion {
  // Ruta absoluta de plan.json.
  plan: string
  puerto: number
  zonaHoraria: string
  // Repositorio git del proyecto; null: se busca desde la carpeta de plan.json.
  repo: string | null
  // Carpeta de sesiones de Claude Code; null: se deduce del repositorio.
  sesiones: string | null
  // Ruta absoluta de asignaciones.json; el archivo puede no existir.
  asignaciones: string
  identificador: string
  // Archivo de configuración leído, o null si no hubo.
  archivo: string | null
}

const CLAVES = ['plan', 'puerto', 'zonaHoraria', 'repo', 'sesiones', 'asignaciones', 'identificador'] as const
type Clave = (typeof CLAVES)[number]
type Parcial = Partial<Record<Clave, string | number | null>>

// Argumentos: --plan, --puerto, --zona, --repo, --sesiones, --asignaciones, --identificador, --config.
const ARGUMENTOS: Record<string, Clave | 'config'> = {
  '--plan': 'plan',
  '--puerto': 'puerto',
  '--zona': 'zonaHoraria',
  '--repo': 'repo',
  '--sesiones': 'sesiones',
  '--asignaciones': 'asignaciones',
  '--identificador': 'identificador',
  '--config': 'config',
}

const VARIABLES: Record<string, Clave | 'config'> = {
  PLAN_VIVO_PLAN: 'plan',
  PLAN_VIVO_PUERTO: 'puerto',
  PLAN_VIVO_ZONA: 'zonaHoraria',
  PLAN_VIVO_REPO: 'repo',
  PLAN_VIVO_SESIONES: 'sesiones',
  PLAN_VIVO_ASIGNACIONES: 'asignaciones',
  PLAN_VIVO_IDENTIFICADOR: 'identificador',
  PLAN_VIVO_CONFIG: 'config',
}

export class ErrorDeConfiguracion extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorDeConfiguracion'
  }
}

function leerArgumentos(args: string[]): { valores: Parcial; config?: string; resto: string[] } {
  const valores: Parcial = {}
  let config: string | undefined
  const resto: string[] = []
  for (let i = 0; i < args.length; i++) {
    const [nombre, enLinea] = args[i].split(/=(.*)/s, 2)
    const clave = ARGUMENTOS[nombre]
    if (!clave) {
      resto.push(args[i])
      continue
    }
    const valor = enLinea ?? args[++i]
    if (valor === undefined || valor.startsWith('--')) throw new ErrorDeConfiguracion(`Falta el valor de ${nombre}`)
    if (clave === 'config') config = valor
    else valores[clave] = valor
  }
  return { valores, config, resto }
}

function leerArchivo(ruta: string): Parcial {
  let crudo: unknown
  try {
    crudo = JSON.parse(readFileSync(ruta, 'utf8'))
  } catch (error) {
    throw new ErrorDeConfiguracion(`No se pudo leer ${ruta}: ${(error as Error).message}`)
  }
  if (crudo === null || typeof crudo !== 'object' || Array.isArray(crudo)) throw new ErrorDeConfiguracion(`${ruta}: debe ser un objeto JSON`)
  const objeto = crudo as Record<string, unknown>
  const desconocidas = Object.keys(objeto).filter((clave) => clave !== '$comentario' && !CLAVES.includes(clave as Clave))
  if (desconocidas.length) throw new ErrorDeConfiguracion(`${ruta}: claves no reconocidas: ${desconocidas.join(', ')}. Válidas: ${CLAVES.join(', ')}`)
  for (const [clave, valor] of Object.entries(objeto)) {
    if (clave === '$comentario') continue
    const tipoValido = clave === 'puerto' ? typeof valor === 'number' : typeof valor === 'string' || (valor === null && (clave === 'repo' || clave === 'sesiones'))
    if (!tipoValido) throw new ErrorDeConfiguracion(`${ruta}: ${clave} tiene un tipo no válido`)
  }
  return objeto as Parcial
}

const absoluta = (ruta: string, base: string) => (isAbsolute(ruta) ? ruta : resolve(base, ruta))

export function leerConfiguracion(
  args: string[] = [],
  entorno: NodeJS.ProcessEnv = process.env,
  { cwd = process.cwd(), raiz = RAIZ_KIT }: { cwd?: string; raiz?: string } = {},
): Configuracion & { resto: string[] } {
  const base = entorno.INIT_CWD ?? cwd
  const argumentos = leerArgumentos(args)
  const deEntorno: Parcial = {}
  let configEntorno: string | undefined
  for (const [variable, clave] of Object.entries(VARIABLES)) {
    const valor = entorno[variable]
    if (valor === undefined || valor === '') continue
    if (clave === 'config') configEntorno = valor
    else deEntorno[clave] = valor
  }

  const rutaPedida = argumentos.config ?? configEntorno
  let archivo: string | null = null
  if (rutaPedida !== undefined) {
    archivo = absoluta(rutaPedida, base)
    if (!existsSync(archivo)) throw new ErrorDeConfiguracion(`No existe el archivo de configuración ${archivo}`)
  } else if (existsSync(join(raiz, ARCHIVO_CONFIG))) {
    archivo = join(raiz, ARCHIVO_CONFIG)
  }
  const delArchivo = archivo ? leerArchivo(archivo) : {}
  const baseArchivo = archivo ? dirname(archivo) : raiz

  // Cada valor recuerda de dónde vino, para resolver sus rutas relativas desde la carpeta correcta.
  const elegir = (clave: Clave): { valor: string | number | null | undefined; base: string } => {
    if (argumentos.valores[clave] !== undefined) return { valor: argumentos.valores[clave], base }
    if (deEntorno[clave] !== undefined) return { valor: deEntorno[clave], base }
    return { valor: delArchivo[clave], base: baseArchivo }
  }
  const ruta = (clave: Clave, porDefecto: string | null): string | null => {
    const { valor, base: desde } = elegir(clave)
    if (valor === undefined || valor === null || valor === '') return porDefecto
    return absoluta(String(valor), desde)
  }

  const plan = ruta('plan', join(raiz, 'plan.json'))!
  const puertoCrudo = elegir('puerto').valor ?? PUERTO_POR_DEFECTO
  const puerto = Number(puertoCrudo)
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new ErrorDeConfiguracion(`Puerto no válido: ${String(puertoCrudo)}`)
  const zonaHoraria = String(elegir('zonaHoraria').valor ?? ZONA_POR_DEFECTO)
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zonaHoraria })
  } catch {
    throw new ErrorDeConfiguracion(`Zona horaria no válida: ${zonaHoraria} (usa un nombre IANA, por ejemplo America/Guayaquil)`)
  }
  const identificador = String(elegir('identificador').valor ?? IDENTIFICADOR_POR_DEFECTO)
  try {
    new RegExp(identificador)
  } catch (error) {
    throw new ErrorDeConfiguracion(`Expresión del identificador no válida: ${(error as Error).message}`)
  }

  return {
    plan,
    puerto,
    zonaHoraria,
    repo: ruta('repo', null),
    sesiones: ruta('sesiones', null),
    // Por defecto, junto a plan.json.
    asignaciones: ruta('asignaciones', join(dirname(plan), 'asignaciones.json'))!,
    identificador,
    archivo,
    resto: argumentos.resto,
  }
}
