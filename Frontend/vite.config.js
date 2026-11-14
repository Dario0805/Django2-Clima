import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En producción el panel compila con rutas /static/... para que whitenoise
// (Django) lo sirva. En desarrollo se queda en la raíz.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/static/' : '/',
  build: {
    // El build de producción nace dentro de Backend: Django lo sirve.
    outDir: '../Backend/static_frontend',
    emptyOutDir: true,
  },
}))
