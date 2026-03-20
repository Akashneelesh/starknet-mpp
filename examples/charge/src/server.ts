import { Mppx, Store } from 'starknet-mpp/server'
import { starknet } from 'starknet-mpp/server'
import { RpcProvider, Account } from 'starknet'

const NETWORK = 'sepolia'
const PROVIDER = new RpcProvider({
  nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YlfzdYl7LCk0JOPXVleaz',
})

const SERVER_PRIVATE_KEY = process.env.STARKNET_PRIVATE_KEY ?? '0x1234'
const SERVER_ADDRESS = process.env.STARKNET_ADDRESS ?? '0x07ECF868164055d6EC98C61a8a7DAc3c8150312d533E8f9c69D92b3162641F63'

const serverAccount = new Account({ provider: PROVIDER, address: SERVER_ADDRESS, signer: SERVER_PRIVATE_KEY })

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
  secretKey: 'starknet-mpp-example-secret',
})

const bullishFacts = [
  'Scalability: ~1K TPS now, targeting 10K+ by 2027, sub-second finality, fees under $0.01',
  'Onchain Compute: Heaviest compute capacity of any L2 — enabling fully onchain games, perp DEXs, verifiable AI',
  'Web2 UX: Native account abstraction, invisible wallets, paymasters, session keys — 30-second onboarding, zero friction',
  'Decentralization: First rollup with decentralized sequencer (live); dual-token staking with STRK + BTC; full decentralization by 2027',
  'Post-Quantum: STARKs are quantum-resistant by design; programmable accounts make wallet upgrades easier when the time comes',
  'Privacy: STRK20s brings private balances and transfers to any ERC-20; strkBTC = private Bitcoin with BTCFi utility',
]

export async function handler(request: Request): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname === '/api/health') { return Response.json({ status: 'ok' }) }
  if (url.pathname === '/api/bullish') {
    const result = await mppx.charge({ amount: '0.000000000000001', description: 'A bullish thing about Starknet' })(request)
    if (result.status === 402) return result.challenge
    const fact = bullishFacts[Math.floor(Math.random() * bullishFacts.length)]!
    return result.withReceipt(Response.json({ fact }))
  }
  return null
}
