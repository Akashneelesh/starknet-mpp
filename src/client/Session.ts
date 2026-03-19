import { Method, Credential } from 'mppx'
import { RpcProvider, Contract } from 'starknet'
import * as Methods from '../Methods.js'
import { RPC_ENDPOINTS } from '../constants.js'
import type { StarknetNetwork, WalletLike } from '../types.js'
import { parseAmount } from '../utils.js'
import { ERC20_ABI } from '../abi.js'

interface ActiveSession {
  sessionId: string
  bearer: string
}

export namespace session {
  export interface Parameters {
    wallet: WalletLike | (() => WalletLike | Promise<WalletLike>)
    network?: StarknetNetwork
    provider?: RpcProvider
  }
}

export function session(parameters: session.Parameters) {
  const { network = 'mainnet' } = parameters

  const provider =
    parameters.provider ?? new RpcProvider({ nodeUrl: RPC_ENDPOINTS[network] })

  let walletInstance: WalletLike | undefined
  let activeSession: ActiveSession | null = null
  let pendingTopUp = false
  let pendingClose = false

  async function getWallet(): Promise<WalletLike> {
    if (walletInstance) return walletInstance
    const w = parameters.wallet
    walletInstance = typeof w === 'function' ? await w() : w
    return walletInstance
  }

  async function sendTransfer(
    wallet: WalletLike,
    methodDetails: { recipient: string; tokenAddress: string; decimals: number },
    amount: string,
  ): Promise<string> {
    const amountRaw = parseAmount(amount, methodDetails.decimals)
    // NOTE: starknet v9 Contract uses options object
    const erc20 = new Contract({ abi: ERC20_ABI, address: methodDetails.tokenAddress, providerOrAccount: wallet.account })
    const tx = await erc20.invoke('transfer', [methodDetails.recipient, amountRaw])
    await provider.waitForTransaction(tx.transaction_hash)
    return tx.transaction_hash
  }

  const method = Method.toClient(Methods.session, {
    async createCredential({ challenge }) {
      const wallet = await getWallet()
      const { methodDetails } = challenge.request

      if (pendingClose && activeSession) {
        const payload = { action: 'close' as const, sessionId: activeSession.sessionId, bearer: activeSession.bearer }
        pendingClose = false
        const result = Credential.serialize({ challenge, payload })
        activeSession = null
        return result
      }

      if (pendingTopUp && activeSession) {
        const topUpTransactionHash = await sendTransfer(wallet, methodDetails, challenge.request.amount)
        const payload = { action: 'topUp' as const, sessionId: activeSession.sessionId, topUpTransactionHash }
        pendingTopUp = false
        return Credential.serialize({ challenge, payload })
      }

      if (activeSession) {
        return Credential.serialize({
          challenge,
          payload: { action: 'bearer' as const, sessionId: activeSession.sessionId, bearer: activeSession.bearer },
        })
      }

      const depositAmount = challenge.request.depositAmount ?? challenge.request.amount
      const depositTransactionHash = await sendTransfer(wallet, methodDetails, depositAmount)

      const payload = { action: 'open' as const, depositTransactionHash, refundAddress: wallet.address }
      activeSession = { sessionId: '', bearer: depositTransactionHash }

      return Credential.serialize({ challenge, payload })
    },
  })

  function topUp(): void { pendingTopUp = true }
  function close(): void { pendingClose = true }
  function getSession(): ActiveSession | null { return activeSession ? { ...activeSession } : null }
  function setSessionId(sessionId: string): void { if (activeSession) { activeSession.sessionId = sessionId } }
  function resetSession(): void { activeSession = null; pendingTopUp = false; pendingClose = false }
  function cleanup(): void { resetSession(); walletInstance = undefined }

  return Object.assign(method, { topUp, close, getSession, setSessionId, resetSession, cleanup })
}
