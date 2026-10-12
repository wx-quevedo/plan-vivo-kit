import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { SIN_ASIGNACIONES, type Asignaciones, type Commit } from './tramos'

// Raíz del repositorio git que contiene una carpeta.
export function raizGit(carpeta: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: carpeta, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch {
    throw new Error(`${carpeta} no está dentro de un repositorio git; indica el repositorio con --repo <carpeta>`)
  }
}

// Nombre de la carpeta de sesiones de Claude Code de un proyecto: la ruta del proyecto con cada carácter que no sea
// letra o número cambiado por un guion. Por ejemplo, C:\xampp\htdocs\mi-app queda como c--xampp-htdocs-mi-app.
// Claude Code puede escribir la letra de unidad en minúscula, así que la comparación ignora mayúsculas.
export function nombreDeCarpeta(repo: string): string {
  return repo.replace(/[^A-Za-z0-9]/g, '-').toLowerCase()
}

// Carpeta de sesiones: ~/.claude/projects/<nombreDeCarpeta(repo)>.
export function carpetaDeSesiones(repo: string, base = join(homedir(), '.claude', 'projects')): string {
  const slug = nombreDeCarpeta(repo)
  const encontrada = existsSync(base) ? readdirSync(base).find((nombre) => nombre.toLowerCase() === slug) : undefined
  if (!encontrada) throw new Error(`No encontré la carpeta de sesiones ${join(base, slug)}; usa --sesiones <carpeta>`)
  return join(base, encontrada)
}

export function archivosDeSesion(carpeta: string): { sesiones: string[]; subagentes: string[] } {
  const sesiones = readdirSync(carpeta)
    .filter((nombre) => nombre.endsWith('.jsonl'))
    .map((nombre) => join(carpeta, nombre))
  const subagentes = sesiones.flatMap((archivo) => {
    const dir = join(archivo.replace(/\.jsonl$/, ''), 'subagents')
    return existsSync(dir)
      ? readdirSync(dir)
          .filter((nombre) => /^agent-.+\.jsonl$/.test(nombre))
          .map((nombre) => join(dir, nombre))
      : []
  })
  return { sesiones, subagentes }
}

export function commitsDeGit(repo: string): Commit[] {
  const salida = execFileSync('git', ['log', '--format=%h|%aI'], { cwd: repo, encoding: 'utf8' })
  return salida
    .split('\n')
    .filter(Boolean)
    .map((linea) => {
      const [hash, fecha] = linea.split('|')
      return { hash, at: Date.parse(fecha) }
    })
}

// El archivo de asignaciones es opcional: si no existe, no hay excepciones. Si existe, se valida campo por campo,
// y cada uno de sus tres campos (mensajes, subagentes, esperas) también es opcional.
export function leerAsignaciones(ruta: string): Asignaciones {
  if (!existsSync(ruta)) return SIN_ASIGNACIONES
  let crudo: unknown
  try {
    crudo = JSON.parse(readFileSync(ruta, 'utf8'))
  } catch (error) {
    throw new Error(`No se pudo leer ${ruta}: ${(error as Error).message}`)
  }
  if (crudo === null || typeof crudo !== 'object' || Array.isArray(crudo)) throw new Error(`${ruta}: debe ser un objeto JSON`)
  const objeto = { ...SIN_ASIGNACIONES, ...(crudo as Record<string, unknown>) } as Record<string, unknown>
  for (const campo of ['mensajes', 'subagentes', 'esperas'] as const) {
    if (objeto[campo] === null || typeof objeto[campo] !== 'object' || Array.isArray(objeto[campo])) {
      throw new Error(`${ruta}: el campo ${campo} debe ser un objeto`)
    }
  }
  for (const campo of ['mensajes', 'esperas'] as const) {
    for (const [clave, valor] of Object.entries(objeto[campo] as object)) {
      if (typeof valor !== 'string') throw new Error(`${ruta}: ${campo}.${clave} debe ser un texto`)
    }
  }
  for (const [clave, valor] of Object.entries(objeto.subagentes as object)) {
    if (!Array.isArray(valor) || !valor.every((v) => typeof v === 'string')) throw new Error(`${ruta}: subagentes.${clave} debe ser una lista de items`)
  }
  return { mensajes: objeto.mensajes as Record<string, string>, subagentes: objeto.subagentes as Record<string, string[]>, esperas: objeto.esperas as Record<string, string> }
}
