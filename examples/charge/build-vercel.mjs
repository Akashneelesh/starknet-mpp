import { execSync } from 'child_process'
import { mkdirSync, writeFileSync, cpSync, rmSync } from 'fs'

// 1. Build the static frontend
execSync('npx vite build', { stdio: 'inherit' })

// 2. Bundle the API function using Vite in library mode
execSync(`npx vite build --config vite.api.config.ts`, { stdio: 'inherit' })

// 3. Assemble .vercel/output
rmSync('.vercel/output', { recursive: true, force: true })

// Static files
mkdirSync('.vercel/output/static', { recursive: true })
cpSync('dist', '.vercel/output/static', { recursive: true })

// Serverless function
mkdirSync('.vercel/output/functions/api/bullish.func', { recursive: true })
cpSync('dist-api/bullish.mjs', '.vercel/output/functions/api/bullish.func/index.mjs')
writeFileSync('.vercel/output/functions/api/bullish.func/.vc-config.json', JSON.stringify({
  runtime: 'nodejs20.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: true,
  supportsResponseStreaming: true,
}))

// Config
writeFileSync('.vercel/output/config.json', JSON.stringify({
  version: 3,
  routes: [
    { src: '/api/bullish', dest: '/api/bullish' },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index.html' },
  ],
}))

console.log('Vercel output assembled.')
