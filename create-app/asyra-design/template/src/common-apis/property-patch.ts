import { isEqual } from 'lodash'

export const getChangedDefinedPatchEntries = <
  Value extends object,
  Key extends keyof Value
>(
  keys: readonly Key[],
  currentValue: Value,
  patch: Partial<Pick<Value, Key>>
): (readonly [Key, Value[Key]])[] =>
  keys.flatMap((key) => {
    if (!(key in patch)) {
      return []
    }

    const nextValue = patch[key]
    if (nextValue === undefined || isEqual(currentValue[key], nextValue)) {
      return []
    }

    return [[key, nextValue] as const]
  })
