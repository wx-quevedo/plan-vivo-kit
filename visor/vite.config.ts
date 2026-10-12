import { existsSync, readFileSync, unwatchFile, watchFile } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { leerConfiguracion } from '../configuracion.ts'

// La configuración llega por variables PLAN_VIVO_* (las pone bin/visor.ts) o por plan-vivo.config.json.
const config = leerConfiguracion([])

// Cada cuánto se revisa plan.json en disco.
const INTERVALO_MS = 250

// Sirve plan.json desde su ruta en disco (GET /plan.json, leído en cada pedido) y avisa al navegador cuando cambia.
// No hay API ni login: es el mismo servidor de desarrollo de Vite, solo en localhost.
// Se vigila con fs.watchFile (sondeo del archivo) y no con el vigilante de Vite: en Windows, este último perdía el
// segundo de dos guardados seguidos. El sondeo también detecta cuando el archivo se borra o aparece.
function planVivo(ruta: string): Plugin {
  return {
    name: 'plan-vivo',
    configureServer(server) {
      const avisar = () => server.ws.send({ type: 'custom', event: 'plan-vivo:cambio' })
      watchFile(ruta, { interval: INTERVALO_MS }, avisar)
      server.httpServer?.on('close', () => unwatchFile(ruta, avisar))
      server.middlewares.use('/plan.json', (_req, res) => {
        res.setHeader('Cache-Control', 'no-store')
        if (!existsSync(ruta)) {
          res.statusCode = 404
          res.end('')
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(readFileSync(ruta, 'utf8'))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), planVivo(config.plan)],
  define: {
    __PLAN_VIVO__: JSON.stringify({ ruta: config.plan, zona: config.zonaHoraria }),
  },
  server: {
    host: 'localhost',
    port: config.puerto,
    strictPort: true,
  },
})
