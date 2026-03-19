export function parseAmount(amount: string, decimals: number): bigint {
  const parts = amount.split('.')
  if (parts.length > 2) { throw new Error(`Invalid amount format: "${amount}"`) }
  const whole = parts[0] ?? '0'
  const frac = parts[1] ?? ''
  if (frac.length > decimals) {
    throw new Error(`Amount "${amount}" has ${frac.length} fractional digits, but token only supports ${decimals} decimals`)
  }
  const paddedFrac = frac.padEnd(decimals, '0')
  return BigInt(whole + paddedFrac)
}
