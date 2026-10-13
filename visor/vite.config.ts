import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Lo fijo del visor. bin/visor.ts agrega al levantarlo el puerto, la zona horaria y el plugin que sirve los planes
// (servidor/plugin.ts): no hay API ni login, es el mismo servidor de desarrollo de Vite, solo en localhost.
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    strictPort: true,
  },
})
