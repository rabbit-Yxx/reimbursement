import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pure Vite + React config — no electron plugin
// Electron main process is compiled separately via build-electron script
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },
})
