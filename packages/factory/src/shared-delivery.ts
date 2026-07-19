import type { TransactionOrigin } from '@asyra/utils'

export type SharedDeliveryOrigin =
  | TransactionOrigin
  | 'rollback-compensation'

export interface SharedDelivery<TPayload = unknown> {
  deliveryId: string
  transactionId: number
  origin: SharedDeliveryOrigin
  kind: 'forward' | 'compensation'
  channel: string
  eventName: string
  payload: TPayload
  sharedDelivery: 'transaction-end' | 'immediate'
  compensatesDeliveryId?: string
}

export type SharedDeliverySubscriber = (delivery: SharedDelivery) => void

export const cloneSharedValue = <T>(
  value: T,
  seen = new WeakMap<object, unknown>()
): T => {
  if (value === null || typeof value !== 'object') return value

  const source = value as object
  const existing = seen.get(source)
  if (existing) return existing as T

  const clone: object = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value))
  seen.set(source, clone)
  Reflect.ownKeys(source).forEach((key) => {
    if (Array.isArray(source) && key === 'length') return
    const descriptor = Object.getOwnPropertyDescriptor(source, key)
    if (!descriptor) return
    const snapshot =
      'value' in descriptor ? descriptor.value : Reflect.get(source, key)
    Object.defineProperty(clone, key, {
      value: cloneSharedValue(snapshot, seen),
      enumerable: descriptor.enumerable,
      configurable: true,
      writable: true
    })
  })
  if (Array.isArray(source) && Array.isArray(clone)) {
    clone.length = source.length
  }
  return clone as T
}

export const cloneSharedDelivery = (
  delivery: SharedDelivery
): SharedDelivery => cloneSharedValue(delivery)
