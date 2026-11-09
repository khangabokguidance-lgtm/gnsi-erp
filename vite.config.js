import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    // Every module screen loads on demand (see App.jsx), so the first download is small. The few chunks still
    // above 500 kB are single big screens or libraries (Exams, Hostel, exceljs, the Meitei Mayek repair table…)
    // that are fetched only when opened — warn only for anything bigger than that.
    chunkSizeWarningLimit: 2200,
  },
})
