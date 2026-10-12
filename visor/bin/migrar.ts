// pnpm migrar [--plan <ruta>] [--aplicar] [--config <ruta>]
// Lleva plan.json a la versión actual del formato (schema_version). Por defecto solo muestra los cambios;
// con --aplicar los escribe, después de validar con el esquema, y deja una copia del original en <plan>.bak.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { ErrorDeConfiguracion, exigirRuta, leerConfiguracion } from '../../configuracion.ts'
import { serializar, type PlanJson } from '../../tiempos/src/plan.ts'
import { migrar } from '../src/plan/migraciones'
import { validatePlan } from '../src/plan/schema'
import { formatIssue, makeT } from '../src/i18n/i18n.tsx'

// Copia de respaldo que no pisa una anterior: plan.json.bak, o plan.json.<fecha>.bak si ya existe.
function rutaDeRespaldo(plan: string, ahora = new Date()): string {
  const simple = `${plan}.bak`
  if (!existsSync(simple)) return simple
  return `${plan}.${ahora.toISOString().replace(/[:.]/g, '-')}.bak`
}

function main(): void {
  const config = leerConfiguracion(process.argv.slice(2))
  const resto = config.resto.filter((arg) => arg !== '--aplicar')
  if (resto.length) throw new ErrorDeConfiguracion(`Argumentos no reconocidos: ${resto.join(' ')}`)
  exigirRuta(config, 'plan', config.plan)
  let crudo: unknown
  try {
    crudo = JSON.parse(readFileSync(config.plan, 'utf8'))
  } catch (error) {
    throw new ErrorDeConfiguracion(`${config.plan} no es JSON válido: ${(error as Error).message}`)
  }

  const resultado = migrar(crudo)
  console.log(`Plan: ${config.plan}`)
  if (resultado.cambios.length === 0) {
    console.log(`Ya está en la versión ${resultado.hasta} del formato: no hay nada que migrar.`)
    return
  }
  console.log(`Versión del formato: ${resultado.desde} -> ${resultado.hasta}`)
  for (const { hasta, lineas } of resultado.cambios) {
    console.log(`\nMigración a la versión ${hasta}:`)
    for (const linea of lineas) console.log(`  ${linea}`)
  }

  const validacion = validatePlan(resultado.plan)
  if (!validacion.ok) {
    const t = makeT('es')
    const detalle = validacion.issues.map((issue) => `- ${formatIssue(issue, t)}`).join('\n')
    throw new Error(`El plan migrado no cumple el esquema; no se escribió nada. Corrige primero:\n${detalle}`)
  }

  if (!config.resto.includes('--aplicar')) {
    console.log('\nModo de revisión: no se escribió nada. Usa --aplicar para escribir plan.json (deja una copia .bak).')
    return
  }
  const respaldo = rutaDeRespaldo(config.plan)
  copyFileSync(config.plan, respaldo)
  writeFileSync(config.plan, serializar(resultado.plan as PlanJson))
  console.log(`\nplan.json migrado y validado. Copia del original: ${respaldo}`)
}

try {
  main()
} catch (error) {
  console.error(`Error: ${(error as Error).message}`)
  process.exitCode = 1
}
