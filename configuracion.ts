// Configuración compartida del visor y del script de tiempos.
// Prioridad: argumentos de la línea de comandos > variables de entorno PLAN_VIVO_* > plan-vivo.config.json > valores por defecto.
// Las rutas de los argumentos y de las variables se resuelven desde la carpeta donde se ejecutó el comando
// (INIT_CWD, que pnpm conserva también con pnpm --dir <kit>); las del archivo, desde la carpeta del archivo.
import { existsSync, readFileSync } from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'
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
  // Solo el visor: todos los planes que sirve, empezando por plan (--plan repetido y la lista planes del archivo).
  planes: string[]
  // Los de la lista planes del archivo, para los mensajes de error.
  planesDelArchivo: string[]
  puerto: number
  zonaHoraria: string
  // Repositorio git del proyecto; null: se busca desde la carpeta de plan.json.
  repo: string | null
  // Carpetas de sesiones de Claude Code (una o varias); null: se deduce del repositorio.
  sesiones: string[] | null
  // Ruta absoluta de asignaciones.json; el archivo puede no existir.
  asignaciones: string
  identificador: string
  // Archivo de configuración leído, o null si no hubo.
  archivo: string | null
  // De dónde salió cada valor, para los mensajes de error.
  origen: Record<Clave, Origen>
}

export type Origen = 'argumento' | 'variable' | 'archivo' | 'defecto'

const CLAVES = ['plan', 'planes', 'puerto', 'zonaHoraria', 'repo', 'sesiones', 'asignaciones', 'identificador'] as const
export type Clave = (typeof CLAVES)[number]
type Valor = string | number | string[] | null
type Parcial = Partial<Record<Clave, Valor>>

// Argumentos: --plan, --puerto, --zona, --repo, --sesiones, --asignaciones, --identificador, --config.
// --sesiones se puede repetir; --plan, solo en el visor (opción variosPlanes); los demás, una sola vez.
// planes solo existe en el archivo: la lista de planes que el visor abre al levantarse.
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

// Nombre del argumento de cada clave, para los mensajes.
const ARGUMENTO_DE = {
  ...Object.fromEntries(Object.entries(ARGUMENTOS).map(([nombre, clave]) => [clave, nombre])),
  planes: '--plan',
} as Record<Clave, string>

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

export function leerArgumentos(
  args: string[],
  { variosPlanes = false }: { variosPlanes?: boolean } = {},
): { valores: Parcial; config?: string; resto: string[]; masPlanes: string[] } {
  const valores: Parcial = {}
  let config: string | undefined
  const resto: string[] = []
  const masPlanes: string[] = []
  for (let i = 0; i < args.length; i++) {
    // pnpm <comando> -- <argumentos> deja pasar el "--" tal cual: se ignora.
    if (args[i] === '--') continue
    const [nombre, enLinea] = args[i].split(/=(.*)/s, 2)
    const clave = ARGUMENTOS[nombre]
    if (!clave) {
      resto.push(args[i])
      continue
    }
    const valor = enLinea ?? args[++i]
    if (valor === undefined || valor === '' || valor.startsWith('--')) throw new ErrorDeConfiguracion(`Falta el valor de ${nombre}`)
    if (clave === 'sesiones') valores.sesiones = [...((valores.sesiones as string[] | undefined) ?? []), valor]
    else if (clave === 'plan' && variosPlanes && valores.plan !== undefined) masPlanes.push(valor)
    else if ((clave === 'config' ? config : valores[clave]) !== undefined) throw new ErrorDeConfiguracion(`${nombre} se indicó más de una vez`)
    else if (clave === 'config') config = valor
    else valores[clave] = valor
  }
  return { valores, config, resto, masPlanes }
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
    // sesiones admite una carpeta o una lista de carpetas; planes, solo una lista.
    const lista = Array.isArray(valor) && valor.length > 0 && valor.every((v) => typeof v === 'string' && v !== '')
    const tipoValido =
      clave === 'puerto'
        ? typeof valor === 'number'
        : clave === 'planes'
          ? lista
          : (clave === 'sesiones' && lista) || typeof valor === 'string' || (valor === null && (clave === 'repo' || clave === 'sesiones'))
    if (!tipoValido) throw new ErrorDeConfiguracion(`${ruta}: ${clave} tiene un tipo no válido`)
  }
  return objeto as Parcial
}

// resolve también normaliza: en Windows, pnpm 11 pasa los argumentos con las barras invertidas duplicadas
// (C:\a\plan.json llega como C:\\a\\plan.json), y resolve las deja simples.
const absoluta = (ruta: string, base: string) => resolve(base, ruta)
const vacio = (valor: Valor | undefined): valor is null | undefined | '' => valor === undefined || valor === null || valor === ''

export function leerConfiguracion(
  args: string[] = [],
  entorno: NodeJS.ProcessEnv = process.env,
  { cwd = process.cwd(), raiz = RAIZ_KIT, variosPlanes = false }: { cwd?: string; raiz?: string; variosPlanes?: boolean } = {},
): Configuracion & { resto: string[] } {
  const base = entorno.INIT_CWD ?? cwd
  const argumentos = leerArgumentos(args, { variosPlanes })
  const deEntorno: Parcial = {}
  let configEntorno: string | undefined
  for (const [variable, clave] of Object.entries(VARIABLES)) {
    const valor = entorno[variable]
    if (valor === undefined || valor === '') continue
    if (clave === 'config') configEntorno = valor
    // PLAN_VIVO_SESIONES admite varias carpetas separadas por el separador de rutas del sistema (; en Windows).
    else if (clave === 'sesiones') deEntorno.sesiones = valor.split(delimiter).filter(Boolean)
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
  const elegir = (clave: Clave): { valor: Valor | undefined; base: string; origen: Origen } => {
    if (argumentos.valores[clave] !== undefined) return { valor: argumentos.valores[clave], base, origen: 'argumento' }
    if (deEntorno[clave] !== undefined) return { valor: deEntorno[clave], base, origen: 'variable' }
    const valor = delArchivo[clave]
    return { valor, base: baseArchivo, origen: vacio(valor) ? 'defecto' : 'archivo' }
  }
  const origen = Object.fromEntries(CLAVES.map((clave) => [clave, elegir(clave).origen])) as Record<Clave, Origen>
  const ruta = (clave: Clave, porDefecto: string | null): string | null => {
    const { valor, base: desde } = elegir(clave)
    if (vacio(valor)) return porDefecto
    return absoluta(String(valor), desde)
  }
  const { valor: valorSesiones, base: baseSesiones } = elegir('sesiones')
  const sesiones = vacio(valorSesiones)
    ? null
    : (Array.isArray(valorSesiones) ? valorSesiones : [String(valorSesiones)]).map((carpeta) => absoluta(carpeta, baseSesiones))

  const plan = ruta('plan', join(raiz, 'plan.json'))!
  const planesDelArchivo = ((delArchivo.planes as string[] | undefined) ?? []).map((r) => absoluta(r, baseArchivo))
  const planes = [plan, ...argumentos.masPlanes.map((r) => absoluta(r, base)), ...planesDelArchivo].filter(
    (r, i, todos) => todos.findIndex((otra) => otra.toLowerCase() === r.toLowerCase()) === i,
  )
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
    planes,
    planesDelArchivo,
    puerto,
    zonaHoraria,
    repo: ruta('repo', null),
    sesiones,
    // Por defecto, junto a plan.json.
    asignaciones: ruta('asignaciones', join(dirname(plan), 'asignaciones.json'))!,
    identificador,
    archivo,
    origen,
    resto: argumentos.resto,
  }
}

const DESCRIPCION = {
  plan: 'el plan',
  planes: 'el plan',
  repo: 'la carpeta del repositorio',
  sesiones: 'la carpeta de sesiones',
  asignaciones: 'el archivo de asignaciones',
} as const

// Falla con un mensaje claro si una ruta no existe: dice de dónde salió y cómo cambiarla.
// Con opcionalPorDefecto, la ausencia no es un error cuando nadie indicó la ruta (asignaciones.json es opcional).
export function exigirRuta(
  config: Pick<Configuracion, 'origen' | 'archivo'>,
  clave: keyof typeof DESCRIPCION,
  ruta: string,
  { opcionalPorDefecto = false }: { opcionalPorDefecto?: boolean } = {},
): void {
  const origen = config.origen[clave]
  if (existsSync(ruta) || (opcionalPorDefecto && origen === 'defecto')) return
  const desde = {
    argumento: `indicada con ${ARGUMENTO_DE[clave]}`,
    variable: 'indicada en una variable PLAN_VIVO_*',
    archivo: `indicada en ${config.archivo}`,
    defecto: 'valor por defecto',
  }[origen]
  throw new ErrorDeConfiguracion(
    `No existe ${DESCRIPCION[clave]}: ${ruta} (${desde}). Indica la ruta con ${ARGUMENTO_DE[clave]} <ruta absoluta> o en plan-vivo.config.json.`,
  )
}
