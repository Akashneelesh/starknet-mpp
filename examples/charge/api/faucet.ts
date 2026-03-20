import { RpcProvider, Account, CallData } from 'starknet'
import type { IncomingMessage, ServerResponse } from 'http'

const PROVIDER = new RpcProvider({
  nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YlfzdYl7LCk0JOPXVleaz',
})

const TREASURY_PRIVATE_KEY = process.env.STARKNET_PRIVATE_KEY ?? '0x1234'
const TREASURY_ADDRESS = process.env.STARKNET_ADDRESS ?? '0x07ECF868164055d6EC98C61a8a7DAc3c8150312d533E8f9c69D92b3162641F63'
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS ?? '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'

const treasuryAccount = new Account({ provider: PROVIDER, address: TREASURY_ADDRESS, signer: TREASURY_PRIVATE_KEY })

const fundedAddresses = new Set<string>()
const FAUCET_AMOUNT = 200000000000000000n // 0.2 STRK (18 decimals)

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk.toString() })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'POST only' }))
    return
  }

  try {
    const body = await readBody(req)
    const { address } = JSON.parse(body) as { address: string }
    if (!address) {
      res.statusCode = 400
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'address required' }))
      return
    }

    const normalized = address.toLowerCase()
    if (fundedAddresses.has(normalized)) {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ status: 'already_funded' }))
      return
    }

    const tx = await treasuryAccount.execute({
      contractAddress: TOKEN_ADDRESS,
      entrypoint: 'transfer',
      calldata: CallData.compile({
        recipient: address,
        amount: { low: FAUCET_AMOUNT & ((1n << 128n) - 1n), high: FAUCET_AMOUNT >> 128n },
      }),
    })

    await PROVIDER.waitForTransaction(tx.transaction_hash)
    fundedAddresses.add(normalized)

    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ status: 'funded', transactionHash: tx.transaction_hash }))
  } catch (err: any) {
    console.error('Faucet error:', err)
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: err.message }))
  }
}
