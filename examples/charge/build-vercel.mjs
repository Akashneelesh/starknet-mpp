import { execSync } from 'child_process'
import { mkdirSync, writeFileSync, cpSync, rmSync } from 'fs'

// 1. Build the static frontend
execSync('npx vite build', { stdio: 'inherit' })

// 2. Bundle the API functions using Vite
execSync(`npx vite build --config vite.api.config.ts`, { stdio: 'inherit' })

// 3. Assemble .vercel/output
rmSync('.vercel/output', { recursive: true, force: true })

// Static files
mkdirSync('.vercel/output/static', { recursive: true })
cpSync('dist', '.vercel/output/static', { recursive: true })

const vcConfig = (maxDuration = 60) => JSON.stringify({
  runtime: 'nodejs20.x',
  handler: 'index.cjs',
  launcherType: 'Nodejs',
  maxDuration,
})

// Bullish function (include shared chunks)
mkdirSync('.vercel/output/functions/api/bullish.func/assets', { recursive: true })
cpSync('dist-api/bullish.cjs', '.vercel/output/functions/api/bullish.func/index.cjs')
cpSync('dist-api/assets', '.vercel/output/functions/api/bullish.func/assets', { recursive: true })
writeFileSync('.vercel/output/functions/api/bullish.func/.vc-config.json', vcConfig(60))

// Faucet function (include shared chunks)
mkdirSync('.vercel/output/functions/api/faucet.func/assets', { recursive: true })
cpSync('dist-api/faucet.cjs', '.vercel/output/functions/api/faucet.func/index.cjs')
cpSync('dist-api/assets', '.vercel/output/functions/api/faucet.func/assets', { recursive: true })
writeFileSync('.vercel/output/functions/api/faucet.func/.vc-config.json', vcConfig(60))

// Config
writeFileSync('.vercel/output/config.json', JSON.stringify({
  version: 3,
  routes: [
    { src: '/api/bullish', dest: '/api/bullish' },
    { src: '/api/faucet', dest: '/api/faucet' },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index.html' },
  ],
}))

console.log('Vercel output assembled.')
