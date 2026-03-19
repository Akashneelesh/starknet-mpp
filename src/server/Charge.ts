import { Method, Receipt, Store } from 'mppx'
import { RpcProvider } from 'starknet'
import * as Methods from '../Methods.js'
import { RPC_ENDPOINTS } from '../constants.js'
import type { StarknetNetwork } from '../types.js'
import { parseAmount } from '../utils.js'
import { findAndVerifyTransfer } from './verify.js'

export namespace charge {
  export interface Parameters {
    recipient: string
    tokenAddress: string
    decimals: number
    network?: StarknetNetwork
    provider?: RpcProvider
    store?: Store.Store
    verifyTimeout?: number
  }
}

export function charge(parameters: charge.Parameters) {
  const {
    recipient,
    tokenAddress,
    decimals,
    network = 'mainnet',
    store,
  } = parameters

  const provider =
    parameters.provider ?? new RpcProvider({ nodeUrl: RPC_ENDPOINTS[network] })

  const txLocks = new Map<string, Promise<void>>()

  async function withTransactionLock<T>(txHash: string, fn: () => Promise<T>): Promise<T> {
    const existing = txLocks.get(txHash) ?? Promise.resolve()
    let resolve: () => void
    const next = new Promise<void>((r) => { resolve = r })
    txLocks.set(txHash, next)
    try {
      await existing
      return await fn()
    } finally {
      resolve!()
      if (txLocks.get(txHash) === next) {
        txLocks.delete(txHash)
      }
    }
  }

  return Method.toServer(Methods.charge, {
    defaults: {
      currency: tokenAddress,
      methodDetails: {
        recipient: '',
        tokenAddress: '',
        decimals: 0,
        network,
      },
    },

    async request({ credential, request }) {
      if (credential) {
        return credential.challenge.request as typeof request
      }
      return {
        ...request,
        methodDetails: { recipient, tokenAddress, decimals, network },
      }
    },

    async verify({ credential }) {
      const { transactionHash } = credential.payload
      const { methodDetails } = credential.challenge.request

      return withTransactionLock(transactionHash, async () => {
        if (store) {
          const consumedKey = `starknet-charge:consumed:${transactionHash}`
          if (await store.get(consumedKey)) {
            throw new Error('Transaction hash already consumed')
          }
        }

        const expectedAmount = parseAmount(
          credential.challenge.request.amount,
          methodDetails.decimals,
        )

        await findAndVerifyTransfer(provider, {
          transactionHash,
          expectedRecipient: methodDetails.recipient,
          expectedTokenAddress: methodDetails.tokenAddress,
          expectedAmount,
        })

        if (store) {
          const consumedKey = `starknet-charge:consumed:${transactionHash}`
          await store.put(consumedKey, true)
        }

        return Receipt.from({
          method: 'starknet',
          reference: transactionHash,
          status: 'success',
          timestamp: new Date().toISOString(),
        })
      })
    },
  })
}
