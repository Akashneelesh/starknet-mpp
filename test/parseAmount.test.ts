import { describe, it, expect } from 'vitest'
import { parseAmount } from '../src/utils.js'

describe('parseAmount', () => {
  it('parses whole numbers', () => { expect(parseAmount('100', 6)).toBe(100_000_000n) })
  it('parses decimal amounts', () => { expect(parseAmount('1.5', 6)).toBe(1_500_000n) })
  it('parses small amounts', () => { expect(parseAmount('0.001', 6)).toBe(1_000n) })
  it('parses exact decimals', () => { expect(parseAmount('0.000001', 6)).toBe(1n) })
  it('parses zero', () => { expect(parseAmount('0', 6)).toBe(0n); expect(parseAmount('0.0', 6)).toBe(0n) })
  it('rejects excess precision', () => { expect(() => parseAmount('0.0000009', 6)).toThrow('has 7 fractional digits, but token only supports 6 decimals') })
  it('rejects excess precision on non-zero amounts', () => { expect(() => parseAmount('1.1234567', 6)).toThrow('has 7 fractional digits, but token only supports 6 decimals') })
  it('rejects invalid format with multiple dots', () => { expect(() => parseAmount('1.2.3', 6)).toThrow('Invalid amount format') })
  it('handles 0 decimals', () => { expect(parseAmount('100', 0)).toBe(100n); expect(() => parseAmount('100.1', 0)).toThrow('has 1 fractional digits, but token only supports 0 decimals') })
  it('handles 18 decimals (Starknet ETH)', () => { expect(parseAmount('1.5', 18)).toBe(1_500_000_000_000_000_000n); expect(parseAmount('0.000000000000000001', 18)).toBe(1n) })
})
