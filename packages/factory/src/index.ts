import factory, { Factory } from './factory.js'
import { initFactorySubscribe } from './subscribes.js'
import type {
  SharedDataChannelBatchChangeHandler,
  SharedDataChannelChangeHandler,
  SharedDataChannelName
} from './shared-data-channel.js'

initFactorySubscribe()

export const getSharedDataChannelStrict = (name: SharedDataChannelName) =>
  factory.getSharedDataChannelStrict(name)

export const getSharedDataChannel = (name: SharedDataChannelName) =>
  factory.getSharedDataChannel(name)

export const createLocalSharedDataChannel = () =>
  factory.createLocalSharedDataChannel()

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

export const observeSharedDataChannelBatch = <TChange = unknown>(
  name: SharedDataChannelName,
  handler: SharedDataChannelBatchChangeHandler<TChange>
) => factory.observeSharedDataChannelBatch<TChange>(name, handler)

export const updateTransactionBatch = (
  events: Parameters<Factory['updateTransactionBatch']>[0]
) => factory.updateTransactionBatch(events)

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

export const subscribeToSharedDeliveryBatch = (
  subscriber: Parameters<Factory['subscribeToSharedDeliveryBatch']>[0]
) => factory.subscribeToSharedDeliveryBatch(subscriber)

export const subscribeToSharedPublication = (
  subscriber: Parameters<Factory['subscribeToSharedPublication']>[0]
) => factory.subscribeToSharedPublication(subscriber)

export const getActiveStagedDeliveryController = () =>
  factory.getActiveStagedDeliveryController()

export default factory
export { Factory }
export type { FactoryTransactionOwner } from './factory.js'
export {
  LocalSharedDataChannel,
  SharedDataChannelRegistry,
  type SharedDataChannel,
  type SharedDataChannelBatchChangeHandler,
  type SharedDataChannelChangeHandler,
  type SharedDataChannelName
} from './shared-data-channel.js'
export * from './shared-delivery.js'
export * from './mutation-batch.js'
export * from './transaction.js'
