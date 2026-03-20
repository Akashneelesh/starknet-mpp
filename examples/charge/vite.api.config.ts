import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist-api',
    ssr: true,
    rollupOptions: {
      input: {
        bullish: 'api/bullish.ts',
        faucet: 'api/faucet.ts',
      },
      output: {
        entryFileNames: '[name].cjs',
        format: 'cjs',
        exports: 'auto',
      },
    },
  },
  ssr: {
    noExternal: true,
  },
})
