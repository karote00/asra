import factory, { Factory } from './factory'
import { initFactorySubscribe } from './subscribes'
import type {
  SharedDataChannelChangeHandler,
  SharedDataChannelName
} from './shared-data-channel'

initFactorySubscribe()

export const getSharedDataChannelStrict = (name: SharedDataChannelName) =>
  factory.getSharedDataChannelStrict(name)

export const getSharedDataChannel = (name: SharedDataChannelName) =>
  factory.getSharedDataChannel(name)

export const getYjsDataChannel = (name: SharedDataChannelName) =>
  factory.getYjsDataChannel(name)

export const registerSharedDataChannel = (
  name: SharedDataChannelName,
  channel: Parameters<Factory['registerSharedDataChannel']>[1]
) => factory.registerSharedDataChannel(name, channel)

export const unregisterSharedDataChannel = (name: SharedDataChannelName) =>
  factory.unregisterSharedDataChannel(name)

export const hasSharedDataChannel = (name: SharedDataChannelName) =>
  factory.hasSharedDataChannel(name)

export const observeSharedDataChannel = <TChange = unknown>(
  name: SharedDataChannelName,
  handler: SharedDataChannelChangeHandler<TChange>
) => factory.observeSharedDataChannel<TChange>(name, handler)

export const registerTransactionInverter = (
  eventName: string,
  inverter: Parameters<Factory['registerTransactionInverter']>[1]
) => factory.registerTransactionInverter(eventName, inverter)

export const registerTransactionValidator = (
  name: string,
  validator: Parameters<Factory['registerTransactionValidator']>[1]
) => factory.registerTransactionValidator(name, validator)

export const subscribeToTransactionStatus = (
  subscriber: Parameters<Factory['subscribeToTransactionStatus']>[0]
) => factory.subscribeToTransactionStatus(subscriber)

export default factory
export { Factory }
export * from './shared-data-channel'
export * from './transaction'
