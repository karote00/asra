import factory, { Factory } from './factory'
import { initFactorySubscribe } from './subscribes'
import type {
  SharedDataChannelBatchChangeHandler,
  SharedDataChannelChangeHandler,
  SharedDataChannelName
} from './shared-data-channel'

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
  events: Parameters<Factory['updateTransactionBatch']>[0],
  deliveryEvidence?: Parameters<Factory['updateTransactionBatch']>[1]
) => factory.updateTransactionBatch(events, deliveryEvidence)

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

export const subscribeToSharedDelivery = (
  subscriber: Parameters<Factory['subscribeToSharedDelivery']>[0]
) => factory.subscribeToSharedDelivery(subscriber)

export const subscribeToSharedDeliveryBatch = (
  subscriber: Parameters<Factory['subscribeToSharedDeliveryBatch']>[0]
) => factory.subscribeToSharedDeliveryBatch(subscriber)

export const subscribeToSharedPublication = (
  subscriber: Parameters<Factory['subscribeToSharedPublication']>[0]
) => factory.subscribeToSharedPublication(subscriber)

export const subscribeToMutationBatchArtifact = (
  subscriber: Parameters<Factory['subscribeToMutationBatchArtifact']>[0]
) => factory.subscribeToMutationBatchArtifact(subscriber)

export default factory
export { Factory }
export {
  LocalSharedDataChannel,
  SharedDataChannelRegistry,
  type SharedDataChannel,
  type SharedDataChannelBatchChangeHandler,
  type SharedDataChannelChangeHandler,
  type SharedDataChannelName
} from './shared-data-channel'
export * from './shared-delivery'
export * from './mutation-batch'
export * from './transaction'
