export const ERC20_ABI = [
  {
    type: 'function', name: 'transfer',
    inputs: [
      { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'external',
  },
  {
    type: 'function', name: 'balance_of',
    inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    type: 'event', name: 'Transfer', kind: 'struct',
    members: [
      { name: 'from', type: 'core::starknet::contract_address::ContractAddress', kind: 'key' },
      { name: 'to', type: 'core::starknet::contract_address::ContractAddress', kind: 'key' },
      { name: 'value', type: 'core::integer::u256', kind: 'data' },
    ],
  },
] as const
