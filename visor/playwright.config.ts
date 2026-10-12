// Pruebas de punta a punta del visor. Puertos propios para no chocar con un visor abierto en 5190:
// 5191 para el visor con una copia del ejemplo y 5192 para el kit copiado a una carpeta vacía (kit.spec.ts).
import { defineConfig } from '@playwright/test'
import { PLAN_E2E, PUERTO_E2E, URL_E2E } from './e2e/config'

export default defineConfig({
  testDir: './e2e',
  // En serie: las pruebas de recarga cambian la copia del plan que lee el visor.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: URL_E2E,
    channel: 'chrome',
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    { name: 'e2e', testMatch: /\.spec\.ts/ },
    { name: 'capturas', testMatch: /\.captura\.ts/ },
  ],
  webServer: {
    command: `node e2e/preparar.mjs && pnpm exec tsx bin/visor.ts --plan "${PLAN_E2E}" --puerto ${PUERTO_E2E}`,
    url: URL_E2E,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
