import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist-api',
    ssr: true,
    rollupOptions: {
      input: 'api/bullish.ts',
      output: {
        entryFileNames: 'bullish.mjs',
        format: 'esm',
      },
    },
  },
  ssr: {
    // Bundle everything so the serverless function is self-contained
    noExternal: true,
  },
})
