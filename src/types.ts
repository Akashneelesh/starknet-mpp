import type { AccountInterface } from 'starknet'
export interface WalletLike { address: string; account: AccountInterface }
export type StarknetNetwork = 'mainnet' | 'sepolia' | 'localnet'
