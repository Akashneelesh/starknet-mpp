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

export function parseTransferEvents(
  events: Array<{ from_address: string; keys: string[]; data: string[] }>,
  expectedTokenAddress: string,
): TransferEvent[] {
  const normalizedToken = normalizeAddress(expectedTokenAddress)
  const transfers: TransferEvent[] = []

  for (const event of events) {
    if (normalizeAddress(event.from_address) !== normalizedToken) continue
    if (event.keys.length < 3 || event.data.length < 2) continue

    const from = normalizeAddress(event.keys[1])
    const to = normalizeAddress(event.keys[2])
    const low = BigInt(event.data[0])
    const high = BigInt(event.data[1])
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
