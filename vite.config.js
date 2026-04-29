import { defineConfig } from 'vite'

export default defineConfig({
  root: './', // Le dossier où se trouve ton index.html
  build: {
    outDir: 'dist', // Le dossier de sortie pour Vercel
  },
  server: {
    port: 5173
  }
})