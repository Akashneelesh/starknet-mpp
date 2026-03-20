import { Mppx } from 'starknet-mpp/client'
import { starknet } from 'starknet-mpp/client'
import type { WalletLike } from 'starknet-mpp'
import { StarkSDK, OnboardStrategy } from 'starkzap'
import type { WalletInterface } from 'starkzap'

const setupEl = document.getElementById('setup')!
const readyEl = document.getElementById('ready')!
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement
const buttonEl = document.getElementById('button') as HTMLButtonElement
const outputEl = document.getElementById('output')!
const logEl = document.getElementById('log')!

function log(msg: string) { logEl.textContent += `${logEl.textContent ? '\n' : ''}${msg}` }

const STRK_TOKEN_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'

const sdk = new StarkSDK({ network: 'sepolia' })

let mppx: ReturnType<typeof Mppx.create>

connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true
  connectBtn.textContent = 'Connecting...'
  log('Connecting with Cartridge Controller...')

  try {
    const result = await sdk.onboard({
      strategy: OnboardStrategy.Cartridge,
      cartridge: {
        preset: 'controller',
        policies: [{ target: STRK_TOKEN_ADDRESS, method: 'approve' }],
      },
      feeMode: 'user_pays',
    })

    const szWallet: WalletInterface = result.wallet
    const address = szWallet.address
    const account = szWallet.getAccount()
    const provider = szWallet.getProvider()

    const wallet: WalletLike = { address, account }

    log(`Wallet connected: ${address}`)

    mppx = Mppx.create({
      methods: [starknet.charge({ wallet, network: 'sepolia', provider })],
      polyfill: false,
    })

    setupEl.style.display = 'none'
    readyEl.style.display = 'block'
  } catch (err) {
    log(`Connection failed: ${err}`)
    connectBtn.disabled = false
    connectBtn.textContent = 'Connect Wallet'
  }
})

buttonEl.addEventListener('click', async () => {
  buttonEl.disabled = true
  outputEl.textContent = ''
  outputEl.className = ''
  try {
    log('GET /api/bullish')
    const res = await mppx.fetch('/api/bullish')
    log(`HTTP ${res.status}`)
    if (!res.ok) { const body = await res.text(); log(`Body: ${body}`); throw new Error(`Request failed: ${res.status}`) }
    const { fact } = (await res.json()) as { fact: string }
    outputEl.textContent = fact
  } catch (err) {
    outputEl.textContent = String(err)
    outputEl.className = 'error'
    log(`Error: ${err}`)
  } finally { buttonEl.disabled = false }
})
