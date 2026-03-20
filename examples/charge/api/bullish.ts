import { Mppx, Store } from 'starknet-mpp/server'
import { starknet } from 'starknet-mpp/server'
import { RpcProvider } from 'starknet'
import type { IncomingMessage, ServerResponse } from 'http'

const NETWORK = 'sepolia'
const PROVIDER = new RpcProvider({
  nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YlfzdYl7LCk0JOPXVleaz',
})

const SERVER_ADDRESS = process.env.STARKNET_ADDRESS ?? '0x07ECF868164055d6EC98C61a8a7DAc3c8150312d533E8f9c69D92b3162641F63'
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS ?? '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'
const DECIMALS = 18

const store = Store.memory()

const mppx = Mppx.create({
  methods: [
    starknet.charge({
      recipient: SERVER_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      decimals: DECIMALS,
      network: NETWORK,
      provider: PROVIDER,
      store,
    }),
  ],
  secretKey: process.env.MPP_SECRET_KEY ?? 'starknet-mpp-example-secret',
})

const bullishFacts = [
  'Scalability: ~1K TPS now, targeting 10K+ by 2027, sub-second finality, fees under $0.01',
  'Onchain Compute: Heaviest compute capacity of any L2 — enabling fully onchain games, perp DEXs, verifiable AI',
  'Web2 UX: Native account abstraction, invisible wallets, paymasters, session keys — 30-second onboarding, zero friction',
  'Decentralization: First rollup with decentralized sequencer (live); dual-token staking with STRK + BTC; full decentralization by 2027',
  'Post-Quantum: STARKs are quantum-resistant by design; programmable accounts make wallet upgrades easier when the time comes',
  'Privacy: STRK20s brings private balances and transfers to any ERC-20; strkBTC = private Bitcoin with BTCFi utility',
]

function toWebRequest(req: IncomingMessage): Request {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost'
  const url = `${proto}://${host}${req.url}`

  const headers = new Headers()
  for (const [key, val] of Object.entries(req.headers)) {
    if (val) headers.set(key, Array.isArray(val) ? val[0] : val)
  }

  return new Request(url, { method: req.method, headers })
}

async function sendWebResponse(res: ServerResponse, webRes: Response) {
  res.statusCode = webRes.status
  webRes.headers.forEach((v, k) => res.setHeader(k, v))
  const body = await webRes.arrayBuffer()
  res.end(Buffer.from(body))
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const webRequest = toWebRequest(req)

    const result = await mppx.charge({ amount: '0.000000000000001', description: 'A bullish thing about Starknet' })(webRequest)

    if (result.status === 402) {
      return sendWebResponse(res, result.challenge)
    }

    const fact = bullishFacts[Math.floor(Math.random() * bullishFacts.length)]!
    const response = result.withReceipt(Response.json({ fact }))
    return sendWebResponse(res, response)
  } catch (err: any) {
    console.error('API error:', err)
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: err.message, stack: err.stack }))
  }
}
