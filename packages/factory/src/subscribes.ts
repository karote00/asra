import { registerTransactionOwner } from '@asyra/reactive-events'
import factory from './factory.js'

export const initFactorySubscribe = () =>
  registerTransactionOwner(factory.getTransactionOwner())
