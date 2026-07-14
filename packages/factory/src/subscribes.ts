import { registerTransactionOwner } from '@asyra/reactive-events'
import factory from './factory'

export const initFactorySubscribe = () =>
  registerTransactionOwner(factory.getTransactionOwner())
