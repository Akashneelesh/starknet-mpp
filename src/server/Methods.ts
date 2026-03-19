import { charge as charge_ } from './Charge.js'
import { session as session_ } from './Session.js'

export function starknet(parameters: starknet.Parameters): ReturnType<typeof charge_> {
  return charge_(parameters)
}

export namespace starknet {
  export type Parameters = charge_.Parameters
  export const charge = charge_
  export const session = session_
}
