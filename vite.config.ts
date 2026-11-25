import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    // Avoid clash with other local Vite apps on 5173/5174
    port: 5199,
    strictPort: false,
    proxy: {
      // Browser-dev helper: Flashscore blocks CORS; Electron uses webSecurity:false
      '/fs-feed': {
        target: 'https://global.flashscore.ninja',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/fs-feed/, '/2/x/feed'),
        headers: {
          'X-Fsign': 'SW9D1eZo',
        },
      },
    },
  },
  base: './',
  build: {
    outDir: 'dist',
  },
})
