import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/gnsi-portal/', // GitHub Pages repo name
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('supabase')) return 'supabase'
            return 'vendor'
          }
        }
      }
    }
  }
})
