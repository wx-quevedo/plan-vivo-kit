// pnpm visor [--plan <ruta>] [--puerto <n>] [--zona <IANA>] [--config <ruta>]
// Desde otra carpeta: pnpm --dir <kit> visor -- --plan <ruta>.
// Levanta el visor en http://localhost:<puerto> (5190 por defecto) leyendo plan.json desde la ruta configurada.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { ErrorDeConfiguracion, exigirRuta, leerConfiguracion } from '../../configuracion.ts'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

async function main(): Promise<void> {
  const config = leerConfiguracion(process.argv.slice(2))
  if (config.resto.length) throw new ErrorDeConfiguracion(`Argumentos no reconocidos: ${config.resto.join(' ')}`)
  exigirRuta(config, 'plan', config.plan)
  // vite.config.ts vuelve a leer la configuración: estas variables le pasan lo que llegó por argumentos.
  process.env.PLAN_VIVO_PLAN = config.plan
  process.env.PLAN_VIVO_PUERTO = String(config.puerto)
  process.env.PLAN_VIVO_ZONA = config.zonaHoraria
  if (config.archivo) process.env.PLAN_VIVO_CONFIG = config.archivo

  const servidor = await createServer({ root: raiz, configFile: join(raiz, 'vite.config.ts'), clearScreen: false })
  try {
    await servidor.listen()
  } catch (error) {
    await servidor.close()
    throw new Error(`No se pudo usar el puerto ${config.puerto} (${(error as Error).message}). Elige otro con --puerto o en plan-vivo.config.json.`)
  }
  console.log(`\nVisor del plan vivo en http://localhost:${config.puerto}`)
  console.log(`Plan: ${config.plan}`)
  console.log(`Configuración: ${config.archivo ?? 'sin archivo (valores por defecto)'}`)
  console.log('Se recarga solo al guardar plan.json. Ctrl+C para detenerlo.')
}

main().catch((error: Error) => {
  console.error(`Error: ${error.message}`)
  process.exitCode = 1
})
