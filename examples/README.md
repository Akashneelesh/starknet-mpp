# Starknet MPP Examples

## Charge Example (Pay-Per-Request)

Browser-based example: pay 0.000001 ETH per joke on Starknet Sepolia.

```bash
cd examples/charge
npm install
npm run dev
```

## Session Example (Metered Data API)

CLI-based example: open a prepaid session, fetch pages, close with refund.

```bash
cd examples/session
npm install

# Terminal 1: start the server
npm run dev

# Terminal 2: run the client
STARKNET_PRIVATE_KEY=0x... STARKNET_ADDRESS=0x... npm run client
```
