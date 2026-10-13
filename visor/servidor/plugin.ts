// Servidor de los planes dentro del servidor de desarrollo de Vite. Solo localhost, sin login.
//   GET  /plan.json?plan=<id>   texto del plan (sin id, el primero), leído del disco en cada pedido; 404 si no existe
//   GET  /__plan-vivo/planes    lista de planes del visor; también sirve para saber si en un puerto hay un visor
//   POST /__plan-vivo/planes    agrega un plan ({ "ruta": "<ruta absoluta>" }); exige la cabecera X-Plan-Vivo: 1
// Cada plan se vigila con fs.watchFile (sondeo del archivo) y no con el vigilante de Vite: en Windows, este último
// perdía el segundo de dos guardados seguidos. El sondeo también detecta cuando el archivo se borra o aparece.
import { existsSync, readFileSync, unwatchFile, watchFile } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { comprobarRuta, ErrorDePlan, PlanesDelVisor } from './planes'

// Cada cuánto se revisa cada plan en disco.
const INTERVALO_MS = 250
export const RUTA_PLANES = '/__plan-vivo/planes'
// La cabecera propia obliga al navegador a una consulta previa de CORS que este servidor no aprueba:
// una página de otro origen no puede agregar planes.
export const CABECERA = 'x-plan-vivo'

function json(res: ServerResponse, estado: number, cuerpo: unknown): void {
  res.statusCode = estado
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(cuerpo))
}

async function leerCuerpo(req: IncomingMessage): Promise<unknown> {
  let texto = ''
  for await (const parte of req) {
    texto += String(parte)
    if (texto.length > 10_000) throw new ErrorDePlan('Pedido demasiado grande')
  }
  try {
    return JSON.parse(texto)
  } catch {
    throw new ErrorDePlan('El pedido no es JSON válido')
  }
}

export function planVivo(rutas: string[]): Plugin {
  const planes = new PlanesDelVisor()
  return {
    name: 'plan-vivo',
    configureServer(server) {
      const vigilados: (() => void)[] = []
      const vigilar = (id: string, ruta: string) => {
        const avisar = () => server.ws.send({ type: 'custom', event: 'plan-vivo:cambio', data: { id } })
        watchFile(ruta, { interval: INTERVALO_MS }, avisar)
        vigilados.push(() => unwatchFile(ruta, avisar))
      }
      const agregar = (ruta: string) => {
        const resultado = planes.agregar(ruta)
        if (resultado.nuevo) {
          vigilar(resultado.plan.id, resultado.plan.ruta)
          server.ws.send({ type: 'custom', event: 'plan-vivo:planes' })
        }
        return resultado
      }
      for (const ruta of rutas) agregar(ruta)
      server.httpServer?.on('close', () => vigilados.forEach((dejar) => dejar()))

      server.middlewares.use(RUTA_PLANES, (req, res) => {
        if (req.method === 'GET') return json(res, 200, { visor: 'plan-vivo', planes: planes.lista() })
        if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' })
        if (req.headers[CABECERA] !== '1') return json(res, 403, { error: `Falta la cabecera ${CABECERA}` })
        leerCuerpo(req)
          .then((cuerpo) => json(res, 200, agregar(comprobarRuta((cuerpo as { ruta?: unknown } | null)?.ruta))))
          .catch((error: Error) => json(res, error instanceof ErrorDePlan ? 400 : 500, { error: error.message }))
      })

      server.middlewares.use('/plan.json', (req, res) => {
        const id = new URL(req.url ?? '', 'http://localhost').searchParams.get('plan')
        const plan = planes.buscar(id)
        res.setHeader('Cache-Control', 'no-store')
        if (!plan || !existsSync(plan.ruta)) {
          res.statusCode = 404
          res.end('')
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(readFileSync(plan.ruta, 'utf8'))
      })
    },
  }
}
