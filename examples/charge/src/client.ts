import { Mppx } from 'starknet-mpp/client'
import { starknet } from 'starknet-mpp/client'
import { RpcProvider, Account } from 'starknet'
import type { WalletLike } from 'starknet-mpp'

const setupEl = document.getElementById('setup')!
const readyEl = document.getElementById('ready')!
const buttonEl = document.getElementById('button') as HTMLButtonElement
const outputEl = document.getElementById('output')!
const logEl = document.getElementById('log')!

function log(msg: string) { logEl.textContent += `${logEl.textContent ? '\n' : ''}${msg}` }

const PROVIDER = new RpcProvider({
  nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YlfzdYl7LCk0JOPXVleaz',
})

const PRIVATE_KEY = prompt('Enter your Starknet Sepolia private key:') ?? ''
const ADDRESS = prompt('Enter your Starknet Sepolia address:') ?? ''

const account = new Account(PROVIDER, ADDRESS, PRIVATE_KEY)
const wallet: WalletLike = { address: ADDRESS, account }

let mppx: ReturnType<typeof Mppx.create>

try {
  log(`Wallet: ${ADDRESS}`)
  mppx = Mppx.create({
    methods: [starknet.charge({ wallet, network: 'sepolia', provider: PROVIDER })],
    polyfill: false,
  })
  setupEl.style.display = 'none'
  readyEl.style.display = 'block'
} catch (err) {
  setupEl.textContent = `Setup failed: ${err}`
  log(`Error: ${err}`)
}

buttonEl.addEventListener('click', async () => {
  buttonEl.disabled = true
  outputEl.textContent = ''
  outputEl.className = ''
  try {
    log('GET /api/joke')
    const res = await mppx.fetch('/api/joke')
    log(`HTTP ${res.status}`)
    if (!res.ok) { const body = await res.text(); log(`Body: ${body}`); throw new Error(`Request failed: ${res.status}`) }
    const { joke } = (await res.json()) as { joke: string }
    outputEl.textContent = joke
  } catch (err) {
    outputEl.textContent = String(err)
    outputEl.className = 'error'
    log(`Error: ${err}`)
  } finally { buttonEl.disabled = false }
})
