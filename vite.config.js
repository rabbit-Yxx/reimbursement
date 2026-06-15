import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Pure Vite + React config — no electron plugin
// Electron main process is compiled separately via build-electron script
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'tessdata/*'],
      manifest: {
        name: '报销材料整理工具',
        short_name: '报销助手',
        description: '完全离线的发票与报销材料自动整理工具',
        theme_color: '#0f172a',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,traineddata,json}'],
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024, // 50MB to cache traineddata
      }
    })
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0', // Allow LAN access for mobile
  },
})
