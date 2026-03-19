import { Method, Receipt, Store } from 'mppx'
import { RpcProvider, Contract, type AccountInterface } from 'starknet'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import * as Methods from '../Methods.js'
import { RPC_ENDPOINTS } from '../constants.js'
import type { StarknetNetwork } from '../types.js'
import { parseAmount } from '../utils.js'
import { findAndVerifyTransfer } from './verify.js'
import { ERC20_ABI } from '../abi.js'

interface SessionState {
  sessionId: string
  bearerHash: string
  depositAmount: bigint
  spent: bigint
  refundAddress: string
  tokenAddress: string
  decimals: number
  status: 'active' | 'closing' | 'closed'
}

interface SerializedSessionState {
  sessionId: string
  bearerHash: string
  depositAmount: string
  spent: string
  refundAddress: string
  tokenAddress: string
  decimals: number
  status: 'active' | 'closing' | 'closed'
}

function serializeState(state: SessionState): SerializedSessionState {
  return { ...state, depositAmount: state.depositAmount.toString(), spent: state.spent.toString() }
}

function deserializeState(raw: SerializedSessionState): SessionState {
  return { ...raw, depositAmount: BigInt(raw.depositAmount), spent: BigInt(raw.spent) }
}

export namespace session {
  export interface Parameters {
    recipient: string
    tokenAddress: string
    decimals: number
    serverAccount: AccountInterface
    network?: StarknetNetwork
    provider?: RpcProvider
    store: Store.Store
    verifyTimeout?: number
  }
}

export function session(parameters: session.Parameters) {
  const { recipient, tokenAddress, decimals, serverAccount, network = 'mainnet', store } = parameters

  const provider = parameters.provider ?? new RpcProvider({ nodeUrl: RPC_ENDPOINTS[network] })

  const sessionLocks = new Map<string, Promise<void>>()

  async function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const existing = sessionLocks.get(sessionId) ?? Promise.resolve()
    let resolve: () => void
    const next = new Promise<void>((r) => { resolve = r })
    sessionLocks.set(sessionId, next)
    try {
      await existing
      return await fn()
    } finally {
      resolve!()
      if (sessionLocks.get(sessionId) === next) { sessionLocks.delete(sessionId) }
    }
  }

  const method = Method.toServer(Methods.session, {
    defaults: {
      currency: tokenAddress,
      depositAmount: '0',
      methodDetails: { recipient: '', tokenAddress: '', decimals: 0, network },
    },

    async request({ credential, request }) {
      if (credential) { return credential.challenge.request as typeof request }
      return { ...request, methodDetails: { recipient, tokenAddress, decimals, network } }
    },

    async verify({ credential }) {
      const { payload } = credential
      const { methodDetails } = credential.challenge.request

      switch (payload.action) {
        case 'open': return handleOpen(payload, methodDetails, credential.challenge.request)
        case 'bearer': return handleBearer(payload, credential.challenge.request)
        case 'topUp': return handleTopUp(payload, methodDetails)
        case 'close': return handleClose(payload)
        default: throw new Error(`Unknown session action: ${(payload as { action: string }).action}`)
      }
    },

    async respond({ credential, receipt }) {
      const { payload } = credential
      if (payload.action === 'topUp' || payload.action === 'close') {
        return new Response(JSON.stringify(receipt), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return undefined
    },
  })

  async function handleOpen(
    payload: { depositTransactionHash: string; refundAddress: string },
    methodDetails: { recipient: string; tokenAddress: string; decimals: number },
    request: { amount: string; depositAmount?: string },
  ): Promise<ReturnType<typeof Receipt.from>> {
    const { depositTransactionHash, refundAddress } = payload

    return withSessionLock(`deposit:${depositTransactionHash}`, async () => {
      const consumedKey = `starknet-session:consumed:${depositTransactionHash}`
      if (await store.get(consumedKey)) { throw new Error('Deposit transaction hash already consumed') }

      const depositAmountStr = request.depositAmount ?? request.amount
      const expectedAmount = parseAmount(depositAmountStr, methodDetails.decimals)

      await findAndVerifyTransfer(provider, {
        transactionHash: depositTransactionHash,
        expectedRecipient: methodDetails.recipient,
        expectedTokenAddress: methodDetails.tokenAddress,
        expectedAmount,
      })

      await store.put(consumedKey, true)

      const bearerHash = bytesToHex(sha256(new TextEncoder().encode(depositTransactionHash)))
      const sessionId = crypto.randomUUID()
      const chargeAmount = parseAmount(request.amount, methodDetails.decimals)

      const state: SessionState = {
        sessionId, bearerHash, depositAmount: expectedAmount, spent: chargeAmount,
        refundAddress, tokenAddress: methodDetails.tokenAddress, decimals: methodDetails.decimals, status: 'active',
      }

      await store.put(`starknet-session:${sessionId}`, serializeState(state))

      return Receipt.from({ method: 'starknet', reference: sessionId, status: 'success', timestamp: new Date().toISOString() })
    })
  }

  async function handleBearer(
    payload: { sessionId: string; bearer: string },
    request: { amount: string; methodDetails: { decimals: number } },
  ): Promise<ReturnType<typeof Receipt.from>> {
    return withSessionLock(payload.sessionId, async () => {
      const state = await loadSession(payload.sessionId)
      verifyBearer(state, payload.bearer)

      const chargeAmount = parseAmount(request.amount, request.methodDetails.decimals)
      const remaining = state.depositAmount - state.spent
      if (chargeAmount > remaining) { throw new Error(`Insufficient session balance: ${remaining} < ${chargeAmount}`) }
      state.spent += chargeAmount
      await store.put(`starknet-session:${state.sessionId}`, serializeState(state))

      return Receipt.from({ method: 'starknet', reference: state.sessionId, status: 'success', timestamp: new Date().toISOString() })
    })
  }

  async function handleTopUp(
    payload: { sessionId: string; topUpTransactionHash: string },
    methodDetails: { recipient: string; tokenAddress: string; decimals: number },
  ): Promise<ReturnType<typeof Receipt.from>> {
    return withSessionLock(payload.sessionId, async () => {
      const consumedKey = `starknet-session:topup-consumed:${payload.topUpTransactionHash}`
      if (await store.get(consumedKey)) { throw new Error('Top-up transaction hash already consumed') }

      const state = await loadSession(payload.sessionId)

      const result = await findAndVerifyTransfer(provider, {
        transactionHash: payload.topUpTransactionHash,
        expectedRecipient: methodDetails.recipient,
        expectedTokenAddress: methodDetails.tokenAddress,
        expectedAmount: 1n,
      })

      await store.put(consumedKey, true)
      state.depositAmount += result.amount
      await store.put(`starknet-session:${state.sessionId}`, serializeState(state))

      return Receipt.from({ method: 'starknet', reference: state.sessionId, status: 'success', timestamp: new Date().toISOString() })
    })
  }

  async function handleClose(
    payload: { sessionId: string; bearer: string },
  ): Promise<ReturnType<typeof Receipt.from>> {
    return withSessionLock(payload.sessionId, async () => {
      const state = await loadSession(payload.sessionId)
      verifyBearer(state, payload.bearer)

      state.status = 'closing'
      await store.put(`starknet-session:${state.sessionId}`, serializeState(state))

      const refundAmount = state.depositAmount - state.spent
      if (refundAmount > 0n) { await sendRefund(state, refundAmount) }

      state.status = 'closed'
      await store.put(`starknet-session:${state.sessionId}`, serializeState(state))

      return Receipt.from({ method: 'starknet', reference: state.sessionId, status: 'success', timestamp: new Date().toISOString() })
    })
  }

  async function loadSession(sessionId: string): Promise<SessionState> {
    const raw = await store.get<SerializedSessionState>(`starknet-session:${sessionId}`)
    if (!raw) throw new Error(`Session not found: ${sessionId}`)
    return deserializeState(raw)
  }

  function verifyBearer(state: SessionState, bearer: string, allowClosing = false): void {
    if (state.status === 'closed' || (!allowClosing && state.status === 'closing')) {
      throw new Error(`Session ${state.sessionId} is ${state.status}`)
    }
    const hash = bytesToHex(sha256(new TextEncoder().encode(bearer)))
    if (hash !== state.bearerHash) { throw new Error('Invalid bearer') }
  }

  async function sendRefund(state: SessionState, refundAmount: bigint): Promise<void> {
    const erc20 = new Contract({ abi: ERC20_ABI, address: state.tokenAddress, providerOrAccount: serverAccount })
    const tx = await erc20.invoke('transfer', [state.refundAddress, refundAmount])
    await provider.waitForTransaction(tx.transaction_hash)
  }

  async function deduct(sessionId: string, amount: bigint): Promise<void> {
    return withSessionLock(sessionId, async () => {
      const state = await loadSession(sessionId)
      if (state.status !== 'active') { throw new Error(`Session ${sessionId} is ${state.status}`) }
      const remaining = state.depositAmount - state.spent
      if (amount > remaining) { throw new Error(`Insufficient balance: ${remaining} < ${amount}`) }
      state.spent += amount
      await store.put(`starknet-session:${sessionId}`, serializeState(state))
    })
  }

  async function waitForTopUp(sessionId: string, timeoutMs: number = 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    const initial = await loadSession(sessionId)
    const initialDeposit = initial.depositAmount

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1_000))
      const current = await loadSession(sessionId)
      if (current.depositAmount > initialDeposit) return
    }

    throw new Error(`Timed out waiting for top-up on session ${sessionId}`)
  }

  return Object.assign(method, { deduct, waitForTopUp })
}
