// pnpm visor [--plan <ruta>]... [--puerto <n>] [--zona <IANA>] [--config <ruta>]
// Desde otra carpeta: pnpm --dir <kit> visor -- --plan <ruta>.
// Un solo visor sirve varios planes: --plan se puede repetir, y plan-vivo.config.json acepta una lista "planes".
// Si en el puerto ya hay un visor abierto, no se levanta otro: se le suman los planes y se muestra su dirección.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { ErrorDeConfiguracion, exigirRuta, leerConfiguracion } from '../../configuracion.ts'
import { CABECERA, planVivo, RUTA_PLANES } from '../servidor/plugin'
import type { PlanDelVisor } from '../servidor/planes'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

const direccion = (puerto: number, plan: PlanDelVisor, primero: boolean) =>
  `http://localhost:${puerto}/${primero ? '' : `?plan=${encodeURIComponent(plan.id)}`}`

// ¿Hay un visor del plan vivo escuchando en el puerto? Cualquier otra respuesta, o ninguna, es que no.
async function visorAbierto(puerto: number): Promise<PlanDelVisor[] | null> {
  try {
    const respuesta = await fetch(`http://localhost:${puerto}${RUTA_PLANES}`, { signal: AbortSignal.timeout(1500) })
    const cuerpo = (await respuesta.json()) as { visor?: string; planes?: PlanDelVisor[] }
    return cuerpo.visor === 'plan-vivo' && Array.isArray(cuerpo.planes) ? cuerpo.planes : null
  } catch {
    return null
  }
}

async function sumarAlVisor(puerto: number, rutas: string[]): Promise<void> {
  console.log(`\nEl visor del plan vivo ya está abierto en http://localhost:${puerto}: no se levanta otro.`)
  for (const ruta of rutas) {
    const respuesta = await fetch(`http://localhost:${puerto}${RUTA_PLANES}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [CABECERA]: '1' },
      body: JSON.stringify({ ruta }),
    })
    const cuerpo = (await respuesta.json()) as { plan?: PlanDelVisor; nuevo?: boolean; error?: string }
    if (!respuesta.ok || !cuerpo.plan) throw new Error(`El visor no aceptó ${ruta}: ${cuerpo.error ?? respuesta.status}`)
    const planes = (await visorAbierto(puerto)) ?? []
    const primero = planes[0]?.id === cuerpo.plan.id
    console.log(`${cuerpo.nuevo ? 'Plan agregado' : 'El plan ya estaba'}: ${cuerpo.plan.ruta}`)
    console.log(`  ${direccion(puerto, cuerpo.plan, primero)}`)
  }
}

async function main(): Promise<void> {
  const config = leerConfiguracion(process.argv.slice(2), process.env, { variosPlanes: true })
  if (config.resto.length) throw new ErrorDeConfiguracion(`Argumentos no reconocidos: ${config.resto.join(' ')}`)
  for (const ruta of config.planes) exigirRuta(config, config.planesDelArchivo.includes(ruta) ? 'planes' : 'plan', ruta)

  if (await visorAbierto(config.puerto)) return sumarAlVisor(config.puerto, config.planes)

  const servidor = await createServer({
    root: raiz,
    configFile: join(raiz, 'vite.config.ts'),
    clearScreen: false,
    plugins: [planVivo(config.planes)],
    define: { __PLAN_VIVO__: JSON.stringify({ zona: config.zonaHoraria }) },
    server: { port: config.puerto },
  })
  try {
    await servidor.listen()
  } catch (error) {
    await servidor.close()
    throw new Error(`No se pudo usar el puerto ${config.puerto} (${(error as Error).message}). Elige otro con --puerto o en plan-vivo.config.json.`)
  }
  const planes = (await visorAbierto(config.puerto)) ?? []
  console.log(`\nVisor del plan vivo en http://localhost:${config.puerto}`)
  planes.forEach((plan, i) => console.log(`Plan: ${plan.ruta}\n  ${direccion(config.puerto, plan, i === 0)}`))
  console.log(`Configuración: ${config.archivo ?? 'sin archivo (valores por defecto)'}`)
  console.log('Se recarga solo al guardar cada plan. Para sumar otro, corre el mismo comando con su --plan. Ctrl+C para detenerlo.')
}

main().catch((error: Error) => {
  console.error(`Error: ${error.message}`)
  process.exitCode = 1
})
