import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({ plugins: [react(), tailwindcss()], server: { watch: { ignored: ["**/work/**"] } }, build: { rollupOptions: { output: { manualChunks(id) { if (id.includes('node_modules/three/')) return 'three'; if (id.includes('@react-three/fiber')) return 'fiber' } } } } })

