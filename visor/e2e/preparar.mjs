// Copia el plan de ejemplo a e2e/.tmp/plan.json antes de levantar el visor de las pruebas.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
mkdirSync(join(aqui, '.tmp'), { recursive: true })
copyFileSync(join(aqui, '..', '..', 'ejemplos', 'plan.json'), join(aqui, '.tmp', 'plan.json'))
