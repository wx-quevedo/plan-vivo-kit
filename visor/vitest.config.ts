import { defineConfig } from 'vitest/config'

// Pruebas unitarias del visor; las de punta a punta (e2e/) las corre Playwright.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'servidor/**/*.test.ts'],
  },
})
