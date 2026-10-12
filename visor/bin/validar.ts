// pnpm validar [--plan <ruta>] [--config <ruta>]
// Valida plan.json con el mismo esquema que el visor y lista los problemas con su ubicación. Sale con código 1 si hay alguno.
// Avisa, sin fallar, si el plan no tiene schema_version.
import { readFileSync } from 'node:fs'
import { ErrorDeConfiguracion, exigirRuta, leerConfiguracion } from '../../configuracion.ts'
import { validatePlan, VERSION_ESQUEMA } from '../src/plan/schema.ts'
import { formatIssue, makeT } from '../src/i18n/i18n.tsx'

function main(): void {
  const config = leerConfiguracion(process.argv.slice(2))
  if (config.resto.length) throw new ErrorDeConfiguracion(`Argumentos no reconocidos: ${config.resto.join(' ')}`)
  exigirRuta(config, 'plan', config.plan)
  const texto = readFileSync(config.plan, 'utf8')
  let crudo: unknown
  try {
    crudo = JSON.parse(texto)
  } catch (error) {
    throw new ErrorDeConfiguracion(`${config.plan} no es JSON válido: ${(error as Error).message}`)
  }
  const resultado = validatePlan(crudo)
  if (resultado.ok) {
    const items = resultado.plan.phases.reduce((total, fase) => total + fase.items.length, 0)
    console.log(`plan.json válido: ${config.plan} (${resultado.plan.phases.length} fases, ${items} items)`)
    if (resultado.plan.schema_version === undefined) {
      console.warn(`Aviso: falta schema_version (versión del formato; la actual es ${VERSION_ESQUEMA}). Agrégalo con pnpm migrar --plan ${config.plan} --aplicar`)
    }
    return
  }
  const t = makeT('es')
  console.error(`plan.json no cumple el esquema: ${config.plan}`)
  for (const issue of resultado.issues) console.error(`- ${formatIssue(issue, t)}`)
  process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`Error: ${(error as Error).message}`)
  process.exitCode = 1
}
