import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8071',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8071',
        ws: true,
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8071',
        changeOrigin: true,
      },
    },
  },
})
