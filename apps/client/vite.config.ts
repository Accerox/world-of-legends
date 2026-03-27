import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@wol/shared': '../../packages/shared/src/types.ts',
    },
  },
})
