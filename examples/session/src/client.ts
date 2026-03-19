import { Mppx } from 'starknet-mpp/client'
import { starknet } from 'starknet-mpp/client'
import { RpcProvider, Account } from 'starknet'
import type { WalletLike } from 'starknet-mpp'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const PROVIDER = new RpcProvider({
  nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YlfzdYl7LCk0JOPXVleaz',
})

const PRIVATE_KEY = process.env.STARKNET_PRIVATE_KEY
const ADDRESS = process.env.STARKNET_ADDRESS

if (!PRIVATE_KEY || !ADDRESS) { console.error('Set STARKNET_PRIVATE_KEY and STARKNET_ADDRESS env vars'); process.exit(1) }

const account = new Account(PROVIDER, ADDRESS, PRIVATE_KEY)
const wallet: WalletLike = { address: ADDRESS, account }

console.log(`Client wallet: ${ADDRESS}`)

const sessionMethod = starknet.session({ wallet, network: 'sepolia', provider: PROVIDER })
const mppx = Mppx.create({ methods: [sessionMethod], polyfill: false })

const PAGE_COUNT = 5
console.log(`\n--- Session: fetching ${PAGE_COUNT} pages ---`)

for (let i = 1; i <= PAGE_COUNT; i++) {
  const url = `${BASE_URL}/api/data?page=${i}`
  console.log(`  GET ${url}`)
  const response = await mppx.fetch(url)
  if (!response.ok) { console.error(`  Error: HTTP ${response.status}`); const text = await response.text(); console.error(`  ${text}`); break }
  const data = (await response.json()) as { page: number; content: string }
  console.log(`  Page ${data.page}: ${data.content.slice(0, 60)}...`)

  const receiptHeader = response.headers.get('payment-receipt')
  if (receiptHeader && i === 1) {
    try {
      const receipt = JSON.parse(Buffer.from(receiptHeader, 'base64').toString())
      if (receipt.reference) { sessionMethod.setSessionId(receipt.reference); console.log(`  Session opened: ${receipt.reference}`) }
    } catch { /* best-effort */ }
  }
}

console.log('\n--- Closing session ---')
sessionMethod.close()
const closeRes = await mppx.fetch(`${BASE_URL}/api/data?page=close`)
if (closeRes.ok) { console.log('  Session closed successfully') }
else { console.log(`  Close response: HTTP ${closeRes.status}`) }
console.log('\n--- Done ---')
