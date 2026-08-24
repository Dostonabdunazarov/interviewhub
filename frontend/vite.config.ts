import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    proxy: {
      // Бэкенд слушает 5199 (см. PLAN.md). Прокси избавляет от CORS в dev
      // и позволяет фронту ходить по относительному /api — как в проде за nginx.
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:5199',
        changeOrigin: true,
      },
    },
  },
})
