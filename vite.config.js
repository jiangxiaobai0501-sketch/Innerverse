import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({ base: './', plugins: [react(), tailwindcss(), {name: 'offline-csp', apply: 'build', transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'" }, injectTo: 'head-prepend' }]}], server: { watch: { ignored: ["**/work/**"] } }, build: { rollupOptions: { output: { manualChunks(id) { if (id.includes('node_modules/three/')) return 'three'; if (id.includes('@react-three/fiber')) return 'fiber' } } } } })



