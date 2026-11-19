import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
server: {
  host: '0.0.0.0',
  allowedHosts: true,
  // Les fichiers écrits par le backend (audit.jsonl, db.json…) ne doivent pas
  // déclencher de rechargement complet de la page à chaque requête API.
  watch: {
    ignored: ['**/backend/**', '**/database/**', '**/reference/**', '**/*.md'],
  },
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8787',
      changeOrigin: false,
      secure: false,
    },
  },
},
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
