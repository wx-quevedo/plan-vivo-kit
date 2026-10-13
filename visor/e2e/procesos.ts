// Ayudantes de las pruebas e2e que levantan el visor como proceso aparte.
import { execFileSync, type ChildProcess } from 'node:child_process'
import { rmSync } from 'node:fs'

// Entorno limpio: sin las variables PLAN_VIVO_* ni el INIT_CWD de quien corre las pruebas.
export function entornoLimpio(): NodeJS.ProcessEnv {
  const entorno = { ...process.env }
  for (const clave of Object.keys(entorno)) if (clave.startsWith('PLAN_VIVO_') || clave === 'INIT_CWD') delete entorno[clave]
  return entorno
}

export async function esperarServidor(url: string, proceso: ChildProcess, salida: () => string): Promise<void> {
  const limite = Date.now() + 60_000
  while (Date.now() < limite) {
    if (proceso.exitCode !== null) throw new Error(`pnpm visor terminó antes de tiempo:\n${salida()}`)
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // Todavía no escucha.
    }
    await new Promise((listo) => setTimeout(listo, 300))
  }
  throw new Error(`El visor no respondió en ${url}:\n${salida()}`)
}

export function detener(proceso: ChildProcess): void {
  if (proceso.pid === undefined || proceso.exitCode !== null) return
  if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' })
  else proceso.kill('SIGTERM')
}

// Borra la carpeta temporal de una prueba. En Windows, un proceso recién detenido puede tenerla bloqueada unos
// segundos: si no se puede borrar, queda en la carpeta temporal del sistema y no tapa el resultado de la prueba.
export function borrarCarpeta(carpeta: string): void {
  try {
    rmSync(carpeta, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
  } catch {
    // Se ignora a propósito.
  }
}
