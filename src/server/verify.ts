import { RpcProvider } from 'starknet'

export interface VerifyTransferParams {
  transactionHash: string
  expectedRecipient: string
  expectedTokenAddress: string
  expectedAmount: bigint
}

export interface VerifyTransferResult {
  from: string
  to: string
  amount: bigint
  transactionHash: string
}

const MAX_RPC_RETRIES = 3
const RPC_RETRY_DELAY_MS = 1_000

export function normalizeAddress(addr: string): string {
  const stripped = addr.toLowerCase().replace(/^0x0*/, '')
  return '0x' + stripped
}

function isTransientError(error: Error): boolean {
  return (
    error.message.includes('503') ||
    error.message.includes('429') ||
    error.message.includes('ETIMEDOUT') ||
    error.message.includes('ECONNRESET') ||
    error.message.includes('fetch failed')
  )
}

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RPC_RETRIES): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const isLastAttempt = attempt === retries
      if (isLastAttempt || !(error instanceof Error) || !isTransientError(error)) throw error
      await sleep(RPC_RETRY_DELAY_MS * (attempt + 1))
    }
  }
  throw new Error('Unreachable')
}

export interface TransferEvent {
  from: string
  to: string
  amount: bigint
}

// sn_keccak("Transfer") — the event selector for ERC-20 Transfer events
const TRANSFER_EVENT_KEY = '0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9'

export function parseTransferEvents(
  events: Array<{ from_address: string; keys: string[]; data: string[] }>,
  expectedTokenAddress: string,
): TransferEvent[] {
  const normalizedToken = normalizeAddress(expectedTokenAddress)
  const transfers: TransferEvent[] = []

  for (const event of events) {
    if (normalizeAddress(event.from_address) !== normalizedToken) continue

    // Verify this is a Transfer event by checking the event selector
    if (event.keys.length === 0) continue
    if (normalizeAddress(event.keys[0]) !== normalizeAddress(TRANSFER_EVENT_KEY)) continue

    // ERC-20 Transfer events have two layouts on Starknet:
    //
    // Layout A (indexed from/to — OpenZeppelin with kind: "key"):
    //   keys = [sn_keccak("Transfer"), from, to]
    //   data = [amount.low, amount.high]
    //
    // Layout B (non-indexed — STRK, some OZ contracts with kind: "data"):
    //   keys = [sn_keccak("Transfer")]
    //   data = [from, to, amount.low, amount.high]

    let from: string
    let to: string
    let low: bigint
    let high: bigint

    if (event.keys.length >= 3 && event.data.length >= 2) {
      // Layout A: from/to in keys
      from = normalizeAddress(event.keys[1])
      to = normalizeAddress(event.keys[2])
      low = BigInt(event.data[0])
      high = BigInt(event.data[1])
    } else if (event.keys.length === 1 && event.data.length >= 4) {
      // Layout B: from/to in data
      from = normalizeAddress(event.data[0])
      to = normalizeAddress(event.data[1])
      low = BigInt(event.data[2])
      high = BigInt(event.data[3])
    } else {
      continue
    }

    const amount = low + (high << 128n)
    transfers.push({ from, to, amount })
  }

  return transfers
}

export async function findAndVerifyTransfer(
  provider: RpcProvider,
  params: VerifyTransferParams,
): Promise<VerifyTransferResult> {
  const { transactionHash, expectedRecipient, expectedTokenAddress, expectedAmount } = params

  const receipt = await withRetry(() =>
    provider.getTransactionReceipt(transactionHash),
  )

  if (!receipt.isSuccess()) {
    throw new Error(`Transaction failed or pending: ${transactionHash}`)
  }

  const events = receipt.events as Array<{ from_address: string; keys: string[]; data: string[] }>
  const transfers = parseTransferEvents(events, expectedTokenAddress)

  const normalizedRecipient = normalizeAddress(expectedRecipient)
  const matching = transfers.find(
    (t) => t.to === normalizedRecipient && t.amount >= expectedAmount,
  )

  if (!matching) {
    const total = transfers
      .filter((t) => t.to === normalizedRecipient)
      .reduce((sum, t) => sum + t.amount, 0n)
    throw new Error(
      `Insufficient transfer: expected ${expectedAmount}, got ${total}`,
    )
  }

  return {
    from: matching.from,
    to: matching.to,
    amount: matching.amount,
    transactionHash,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
