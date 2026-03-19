import { Method, z } from 'mppx'

export const charge = Method.from({
  name: 'starknet',
  intent: 'charge',
  schema: {
    credential: { payload: z.object({ transactionHash: z.string() }) },
    request: z.object({
      amount: z.string(),
      currency: z.optional(z.string()),
      description: z.optional(z.string()),
      methodDetails: z.object({
        recipient: z.string(),
        tokenAddress: z.string(),
        decimals: z.number(),
        network: z.optional(z.string()),
      }),
    }),
  },
})

export const session = Method.from({
  name: 'starknet',
  intent: 'session',
  schema: {
    credential: {
      payload: z.discriminatedUnion('action', [
        z.object({ action: z.literal('open'), depositTransactionHash: z.string(), refundAddress: z.string() }),
        z.object({ action: z.literal('bearer'), sessionId: z.string(), bearer: z.string() }),
        z.object({ action: z.literal('topUp'), sessionId: z.string(), topUpTransactionHash: z.string() }),
        z.object({ action: z.literal('close'), sessionId: z.string(), bearer: z.string() }),
      ]),
    },
    request: z.object({
      amount: z.string(),
      currency: z.optional(z.string()),
      description: z.optional(z.string()),
      depositAmount: z.optional(z.string()),
      idleTimeout: z.optional(z.number()),
      unitType: z.optional(z.string()),
      methodDetails: z.object({
        recipient: z.string(),
        tokenAddress: z.string(),
        decimals: z.number(),
        network: z.optional(z.string()),
      }),
    }),
  },
})
