/**
 * Minimal ERC-20 ABI for Starknet — functions only.
 *
 * Events are intentionally excluded because starknet.js v9 has strict ABI
 * event validation that differs between token implementations (e.g., STRK uses
 * kind: "data" for from/to while OpenZeppelin uses kind: "key"). Since we parse
 * Transfer events manually in verify.ts from raw receipt data, we don't need
 * the event ABI here.
 */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'balance_of',
    inputs: [
      { name: 'account', type: 'core::starknet::contract_address::ContractAddress' },
    ],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
] as const
