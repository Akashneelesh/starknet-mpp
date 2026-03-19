import { Mppx, Store } from 'starknet-mpp/server'
import { starknet } from 'starknet-mpp/server'
import { RpcProvider, Account } from 'starknet'

const NETWORK = 'sepolia'
const PROVIDER = new RpcProvider({
  nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YlfzdYl7LCk0JOPXVleaz',
})

const SERVER_PRIVATE_KEY = process.env.STARKNET_PRIVATE_KEY ?? '0x1234'
const SERVER_ADDRESS = process.env.STARKNET_ADDRESS ?? '0x1234'
const serverAccount = new Account({ provider: PROVIDER, address: SERVER_ADDRESS, signer: SERVER_PRIVATE_KEY })

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS ?? '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
const DECIMALS = 18

const store = Store.memory()

const sessionMethod = starknet.session({
  recipient: SERVER_ADDRESS,
  tokenAddress: TOKEN_ADDRESS,
  decimals: DECIMALS,
  serverAccount,
  network: NETWORK,
  provider: PROVIDER,
  store,
})

const mppx = Mppx.create({
  methods: [sessionMethod],
  secretKey: 'starknet-mpp-session-example-secret',
})

export async function handler(request: Request): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname === '/api/health') { return Response.json({ status: 'ok' }) }
  if (url.pathname === '/api/data') {
    const page = url.searchParams.get('page') ?? '1'
    const result = await mppx.session({ amount: '0.000001', depositAmount: '0.00001', unitType: 'page' })(request)
    if (result.status === 402) return result.challenge
    const data = { page: Number(page), content: `Data for page ${page}: ${generateContent(Number(page))}`, timestamp: new Date().toISOString() }
    return result.withReceipt(Response.json(data))
  }
  return null
}

function generateContent(page: number): string {
  const topics = [
    'Starknet uses STARKs for validity proofs with quantum resistance.',
    'Cairo is Starknet\'s native smart contract language.',
    'Starknet has native account abstraction — all accounts are smart contracts.',
    'STRK is the native gas token on Starknet.',
    'Starknet transactions are batched and proven off-chain.',
    'Starknet supports ERC-20 tokens via Cairo contracts.',
    'Madara and Katana provide local Starknet development environments.',
    'Starknet addresses are felt values (field elements).',
    'The Starknet sequencer orders and executes transactions.',
    'Recursive proofs allow Starknet to scale without increasing L1 costs.',
  ]
  return topics[(page - 1) % topics.length]!
}
