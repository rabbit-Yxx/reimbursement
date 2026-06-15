// build-electron.mjs — compile electron/main.js and electron/preload.js with esbuild
import { build } from 'esbuild'
import { mkdirSync } from 'fs'

mkdirSync('dist-electron', { recursive: true })

const external = [
  'electron', 'archiver', 'electron-store', 'exceljs', 'xlsx',
  'pdf-lib', 'pdf-parse', 'sharp', 'tesseract.js',
  'path', 'fs', 'os', 'child_process', 'stream', 'crypto',
  'util', 'events', 'buffer', 'url', 'http', 'https',
  'zlib', 'worker_threads', 'net',
]

await build({
  entryPoints: ['electron/main.js'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist-electron/main.js',
  external,
  sourcemap: true,
})

await build({
  entryPoints: ['electron/preload.js'],
  bundle: true,
  platform: 'node',
  format: 'cjs',   // preload must be CJS for contextBridge
  outfile: 'dist-electron/preload.js',
  external: ['electron'],
  sourcemap: true,
})

console.log('✅ Electron main + preload built to dist-electron/')
