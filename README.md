# starknet-mpp

Starknet MPP SDK — ERC-20 token payments over HTTP 402.

Implements the [Machine Payments Protocol](https://mpp.dev/) on Starknet using starknet.js. Supports one-time charges and prepaid sessions with automatic refunds.

## Install

```bash
npm install starknet-mpp starknet mppx
```

## Quick Start

### Server (Charge)

```typescript
import { Mppx, Store, starknet } from 'starknet-mpp/server'

const mppx = Mppx.create({
  methods: [
    starknet.charge({
      recipient: '0x...', // your wallet address
      tokenAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH
      decimals: 18,
      network: 'sepolia',
      store: Store.memory(),
    }),
  ],
  secretKey: 'your-secret',
})

// In your HTTP handler:
const result = await mppx.charge({ amount: '0.001' })(request)
if (result.status === 402) return result.challenge
return result.withReceipt(Response.json({ data: '...' }))
```

### Client (Charge)

```typescript
import { Mppx, starknet } from 'starknet-mpp/client'

const mppx = Mppx.create({
  methods: [
    starknet.charge({
      wallet: { address: '0x...', account },
      network: 'sepolia',
    }),
  ],
})

const res = await mppx.fetch('https://api.example.com/paid-endpoint')
```

## Payment Models

- **Charge** — one-time pay-per-request. Client signs an ERC-20 transfer, server verifies on-chain.
- **Session** — prepaid account. Client deposits tokens, uses bearer token for subsequent requests, server refunds unused balance on close.

## Networks

- `mainnet` — Starknet mainnet
- `sepolia` — Starknet Sepolia testnet
- `localnet` — Local devnet (starknet-devnet-rs / Katana)

## License

ISC
