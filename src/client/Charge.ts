import { Method, Credential } from 'mppx'
import { RpcProvider, Contract } from 'starknet'
import * as Methods from '../Methods.js'
import { RPC_ENDPOINTS } from '../constants.js'
import type { StarknetNetwork, WalletLike } from '../types.js'
import { parseAmount } from '../utils.js'
import { ERC20_ABI } from '../abi.js'

export namespace charge {
  export interface Parameters {
    wallet: WalletLike | (() => WalletLike | Promise<WalletLike>)
    network?: StarknetNetwork
    provider?: RpcProvider
  }
}

export function charge(parameters: charge.Parameters) {
  const { network = 'mainnet' } = parameters

  const provider =
    parameters.provider ?? new RpcProvider({ nodeUrl: RPC_ENDPOINTS[network] })

  let walletInstance: WalletLike | undefined

  async function getWallet(): Promise<WalletLike> {
    if (walletInstance) return walletInstance
    const w = parameters.wallet
    walletInstance = typeof w === 'function' ? await w() : w
    return walletInstance
  }

  return Method.toClient(Methods.charge, {
    async createCredential({ challenge }) {
      const wallet = await getWallet()
      const { amount, methodDetails } = challenge.request

      const amountRaw = parseAmount(amount, methodDetails.decimals)

      // NOTE: starknet v9 Contract uses options object
      const erc20 = new Contract({ abi: ERC20_ABI, address: methodDetails.tokenAddress, providerOrAccount: wallet.account })
      const tx = await erc20.invoke('transfer', [methodDetails.recipient, amountRaw])

      await provider.waitForTransaction(tx.transaction_hash)

      return Credential.serialize({
        challenge,
        payload: { transactionHash: tx.transaction_hash },
      })
    },
  })
}
