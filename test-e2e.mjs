/**
 * End-to-end test: verifies STRK transfer + verification on Starknet Sepolia.
 *
 * Usage:
 *   node test-e2e.mjs
 */

import { RpcProvider, Account, Contract } from 'starknet'
import { parseAmount } from './dist/utils.js'
import { findAndVerifyTransfer } from './dist/server/verify.js'

const PRIVATE_KEY = '0x07fd0922bf9913c04c8f7d92da0d9a58f9cfae08a25aeb0a75ef902d3a0d9eec'
const ADDRESS = '0x07ECF868164055d6EC98C61a8a7DAc3c8150312d533E8f9c69D92b3162641F63'
const STRK_TOKEN = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'
const DECIMALS = 18

const provider = new RpcProvider({
  nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YlfzdYl7LCk0JOPXVleaz',
})

const account = new Account({ provider, address: ADDRESS, signer: PRIVATE_KEY })

console.log('=== Starknet MPP E2E Test (Sepolia) ===')
console.log(`Account: ${ADDRESS}`)
console.log(`Token: STRK`)
console.log()

// Fetch the real STRK ABI from chain
console.log('Fetching STRK contract ABI from chain...')
const classHash = await provider.getClassHashAt(STRK_TOKEN)
const cls = await provider.getClass(classHash)
const strkAbi = cls.abi

// Check balance
const erc20Read = new Contract({ abi: strkAbi, address: STRK_TOKEN, provider })
const balanceBefore = await erc20Read.call('balance_of', [ADDRESS])
console.log(`STRK balance: ${Number(balanceBefore) / 1e18} STRK`)
console.log()

// --- Step 1: Send a tiny STRK transfer ---
const amount = '0.000000000000001' // 1000 wei
const amountRaw = parseAmount(amount, DECIMALS)

console.log(`Step 1: Sending ${amount} STRK to self (${amountRaw} raw)...`)

const erc20 = new Contract({ abi: strkAbi, address: STRK_TOKEN, providerOrAccount: account })
const tx = await erc20.invoke('transfer', [ADDRESS, amountRaw])
console.log(`  Tx submitted: ${tx.transaction_hash}`)
console.log('  Waiting for confirmation (~15-30s)...')

await provider.waitForTransaction(tx.transaction_hash)
console.log('  Confirmed!')

// --- Step 2: Verify the transfer on-chain ---
console.log()
console.log('Step 2: Verifying transfer on-chain via findAndVerifyTransfer...')

const result = await findAndVerifyTransfer(provider, {
  transactionHash: tx.transaction_hash,
  expectedRecipient: ADDRESS,
  expectedTokenAddress: STRK_TOKEN,
  expectedAmount: amountRaw,
})

console.log('  Verified!')
console.log(`  From: ${result.from}`)
console.log(`  To: ${result.to}`)
console.log(`  Amount: ${result.amount}`)
console.log(`  Tx: ${result.transactionHash}`)

console.log()
console.log('=== E2E Test PASSED ===')
console.log('Transfer + on-chain verification works end-to-end on Sepolia.')
