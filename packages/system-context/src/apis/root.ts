import { SystemContextSnapshot } from '@asyra/utils'
import { HandlerDeps, RootAPIs } from '../types'

const cloneManagedValue = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneManagedValue(item)) as T
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>
    const cloned = Object.fromEntries(
      Object.entries(objectValue).map(([key, item]) => [
        key,
        cloneManagedValue(item)
      ])
    )
    return cloned as T
  }

  return value
}

export const createRootAPIs = (deps: HandlerDeps): RootAPIs => ({
  getSystemContextSnapshot(): SystemContextSnapshot {
    return deps.managedPropertyState.getAllKeys().reduce(
      (snapshot, key) => {
        snapshot[key] = cloneManagedValue(deps.managedPropertyState.get(key))
        return snapshot
      },
      {} as Record<string, unknown>
    ) as SystemContextSnapshot
  }
})
