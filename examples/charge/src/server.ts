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

const jokes = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  'There are only 10 types of people in the world: those who understand binary and those who don\'t.',
  'A SQL query walks into a bar, sees two tables, and asks... "Can I JOIN you?"',
  'Why do Java developers wear glasses? Because they can\'t C#.',
  'What\'s the object-oriented way to become wealthy? Inheritance.',
  'Why do blockchain devs never get lost? They always follow the chain.',
]

export async function handler(request: Request): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname === '/api/health') { return Response.json({ status: 'ok' }) }
  if (url.pathname === '/api/joke') {
    const result = await mppx.charge({ amount: '0.000000000000001', description: 'A programming joke' })(request)
    if (result.status === 402) return result.challenge
    const joke = jokes[Math.floor(Math.random() * jokes.length)]!
    return result.withReceipt(Response.json({ joke }))
  }
  return null
}
