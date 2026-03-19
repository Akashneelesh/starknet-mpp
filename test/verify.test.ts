import { describe, it, expect } from 'vitest'
import {
  normalizeAddress,
  parseTransferEvents,
  type TransferEvent,
} from '../src/server/verify.js'

const TOKEN_ADDRESS = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
const RECIPIENT = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const SENDER = '0xaabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233'
const TRANSFER_KEY = '0x0099cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9'

function makeTransferEvent(
  from: string, to: string, amountLow: bigint, amountHigh: bigint = 0n, tokenAddress: string = TOKEN_ADDRESS,
) {
  return {
    from_address: tokenAddress,
    keys: [TRANSFER_KEY, from, to],
    data: ['0x' + amountLow.toString(16), '0x' + amountHigh.toString(16)],
  }
}

describe('normalizeAddress', () => {
  it('normalizes addresses with different leading zeros', () => {
    expect(normalizeAddress('0x00abc')).toBe(normalizeAddress('0x0abc'))
    expect(normalizeAddress('0x0ABC')).toBe(normalizeAddress('0x0abc'))
  })
})

describe('parseTransferEvents', () => {
  it('parses a valid Transfer event', () => {
    const events = [makeTransferEvent(SENDER, RECIPIENT, 1_000_000n)]
    const transfers = parseTransferEvents(events, TOKEN_ADDRESS)
    expect(transfers).toHaveLength(1)
    expect(transfers[0].amount).toBe(1_000_000n)
    expect(transfers[0].to).toBe(normalizeAddress(RECIPIENT))
  })

  it('filters out events from wrong token address', () => {
    const wrongToken = '0x0deadbeef'
    const events = [makeTransferEvent(SENDER, RECIPIENT, 1_000_000n, 0n, wrongToken)]
    const transfers = parseTransferEvents(events, TOKEN_ADDRESS)
    expect(transfers).toHaveLength(0)
  })

  it('handles Uint256 with non-zero high felt', () => {
    const events = [makeTransferEvent(SENDER, RECIPIENT, 0n, 1n)]
    const transfers = parseTransferEvents(events, TOKEN_ADDRESS)
    expect(transfers[0].amount).toBe(1n << 128n)
  })

  it('handles combined low + high', () => {
    const events = [makeTransferEvent(SENDER, RECIPIENT, 500n, 2n)]
    const transfers = parseTransferEvents(events, TOKEN_ADDRESS)
    expect(transfers[0].amount).toBe(500n + (2n << 128n))
  })

  it('skips events with too few keys or data', () => {
    const events = [
      { from_address: TOKEN_ADDRESS, keys: [TRANSFER_KEY], data: [] },
      { from_address: TOKEN_ADDRESS, keys: [TRANSFER_KEY, SENDER], data: ['0x1'] },
    ]
    const transfers = parseTransferEvents(events, TOKEN_ADDRESS)
    expect(transfers).toHaveLength(0)
  })
})

describe('verifyTransfer (via parseTransferEvents + manual check)', () => {
  function verifyTransfer(transfers: TransferEvent[], expectedRecipient: string, expectedAmount: bigint): TransferEvent {
    const normalizedRecipient = normalizeAddress(expectedRecipient)
    const matching = transfers.find(t => t.to === normalizedRecipient && t.amount >= expectedAmount)
    if (!matching) {
      const total = transfers.filter(t => t.to === normalizedRecipient).reduce((sum, t) => sum + t.amount, 0n)
      throw new Error(`Insufficient transfer: expected ${expectedAmount}, got ${total}`)
    }
    return matching
  }

  it('passes when transfer amount meets expected', () => {
    const transfers: TransferEvent[] = [{ from: normalizeAddress(SENDER), to: normalizeAddress(RECIPIENT), amount: 1_000_000n }]
    expect(() => verifyTransfer(transfers, RECIPIENT, 1_000_000n)).not.toThrow()
  })

  it('passes when transfer exceeds expected', () => {
    const transfers: TransferEvent[] = [{ from: normalizeAddress(SENDER), to: normalizeAddress(RECIPIENT), amount: 2_000_000n }]
    expect(() => verifyTransfer(transfers, RECIPIENT, 1_000_000n)).not.toThrow()
  })

  it('throws when transfer is insufficient', () => {
    const transfers: TransferEvent[] = [{ from: normalizeAddress(SENDER), to: normalizeAddress(RECIPIENT), amount: 500_000n }]
    expect(() => verifyTransfer(transfers, RECIPIENT, 1_000_000n)).toThrow('Insufficient transfer: expected 1000000, got 500000')
  })

  it('throws when no transfer to recipient', () => {
    const other = '0x0999'
    const transfers: TransferEvent[] = [{ from: normalizeAddress(SENDER), to: normalizeAddress(other), amount: 1_000_000n }]
    expect(() => verifyTransfer(transfers, RECIPIENT, 1_000_000n)).toThrow('Insufficient transfer: expected 1000000, got 0')
  })

  it('throws when no transfers at all', () => {
    expect(() => verifyTransfer([], RECIPIENT, 1_000_000n)).toThrow('Insufficient transfer')
  })
})
