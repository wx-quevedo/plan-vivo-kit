// tiempos: propone el work_log de cada item a partir de los registros de sesión de Claude Code y de git log.
// Por defecto solo muestra la tabla de diferencias; con --aplicar escribe plan.json.
// Uso: pnpm tiempos [--aplicar] [--plan <ruta>] [--repo <carpeta>] [--sesiones <carpeta>]... [--asignaciones <ruta>]
//   [--zona <IANA>] [--identificador <regex>] [--config <ruta>]
// Desde otra carpeta: pnpm --dir <kit> tiempos -- --plan <ruta>. --sesiones se puede repetir.
// Sin argumentos usa plan-vivo.config.json; ver AGENTES.md.
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { ErrorDeConfiguracion, exigirRuta, leerConfiguracion } from '../../configuracion.ts'
import { aLocal } from '../../visor/src/lib/zona.ts'
import { readSession, readSubagent } from './jsonl'
import { archivosDeSesiones, carpetaDeSesiones, commitsDeGit, leerAsignaciones, raizGit } from './fuentes'
import { proponer } from './tramos'
import { aplicar, idsDeItems, leerPlan } from './plan'
import { diferencias, tabla } from './diferencias'

function main(): void {
  const config = leerConfiguracion(process.argv.slice(2))
  const resto = config.resto.filter((arg) => arg !== '--aplicar')
  if (resto.length) throw new ErrorDeConfiguracion(`Argumentos no reconocidos: ${resto.join(' ')}`)
  exigirRuta(config, 'plan', config.plan)
  if (config.repo) exigirRuta(config, 'repo', config.repo)
  for (const carpeta of config.sesiones ?? []) exigirRuta(config, 'sesiones', carpeta)
  exigirRuta(config, 'asignaciones', config.asignaciones, { opcionalPorDefecto: true })
  const hora = (ms: number) => aLocal(ms, config.zonaHoraria).slice(0, 19).replace('T', ' ')
  const repo = config.repo ?? raizGit(dirname(config.plan))
  const carpetas = config.sesiones ?? [carpetaDeSesiones(repo)]
  const asignaciones = leerAsignaciones(config.asignaciones)

  const { sesiones, subagentes } = archivosDeSesiones(carpetas)
  console.log(`Plan: ${config.plan}`)
  console.log(`Repositorio: ${repo} · zona: ${config.zonaHoraria}`)
  console.log(`Asignaciones: ${existsSync(config.asignaciones) ? config.asignaciones : 'sin archivo (ninguna excepción)'}`)
  console.log(`Sesiones leídas: ${sesiones.length} · subagentes: ${subagentes.length} · ${carpetas.length === 1 ? 'carpeta' : 'carpetas'}: ${carpetas.join('; ')}`)
  const propuesta = proponer({
    eventos: sesiones.flatMap(readSession).sort((a, b) => a.at - b.at),
    subagentes: subagentes.map(readSubagent),
    commits: commitsDeGit(repo),
    asignaciones,
    items: idsDeItems(leerPlan(config.plan)),
    identificador: new RegExp(config.identificador),
  })

  console.log(`\n${tabla(diferencias(leerPlan(config.plan), propuesta.porItem, config.zonaHoraria))}`)
  for (const s of propuesta.sinAsignar) console.log(`\nSin asignar: mensaje de ${hora(s.at)} (${s.motivo}): ${JSON.stringify(s.firstLine.slice(0, 50))}`)
  for (const s of propuesta.subagentesSinAsignar) console.log(`Sin asignar: subagente ${s.id.slice(0, 8)} de ${hora(s.start)} (no había item abierto)`)
  for (const c of propuesta.commitsFuera) console.log(`Commit fuera de todo tramo: ${c.hash} (${hora(c.at)})`)

  if (config.resto.includes('--aplicar')) {
    const { cambiados } = aplicar(config.plan, propuesta.porItem, config.zonaHoraria)
    console.log(`\nplan.json escrito y validado. Items con cambios: ${cambiados.length ? cambiados.join(', ') : 'ninguno'}`)
  } else {
    console.log('\nModo de revisión: no se escribió nada. Usa --aplicar para escribir plan.json.')
  }
}

try {
  main()
} catch (error) {
  console.error(`Error: ${(error as Error).message}`)
  process.exitCode = 1
}
