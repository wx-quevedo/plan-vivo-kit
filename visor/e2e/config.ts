import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))

export const KIT = join(aqui, '..', '..')
export const EJEMPLO = join(KIT, 'ejemplos', 'plan.json')
// Copia del ejemplo que lee el visor de las pruebas; las pruebas de recarga la modifican y la restauran.
export const PLAN_E2E = join(aqui, '.tmp', 'plan.json')
export const PUERTO_E2E = 5191
export const URL_E2E = `http://localhost:${PUERTO_E2E}`
export const PUERTO_KIT = 5192
// Hora fija de las pruebas y las capturas: durante P4, el item en curso del ejemplo.
export const AHORA = new Date('2026-10-09T15:30:00-05:00')
