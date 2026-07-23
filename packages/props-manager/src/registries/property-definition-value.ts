import { isRecord } from '@asyra/utils'

export const clonePropertyDefinitionValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => clonePropertyDefinitionValue(item))
  }

  if (isRecord(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>(
      (cloned, [key, item]) => {
        cloned[key] = clonePropertyDefinitionValue(item)
        return cloned
      },
      {}
    )
  }

  return value
}

export function clonePropertyDefinitionRecord(
  value: Record<string, unknown>
): Record<string, unknown>
export function clonePropertyDefinitionRecord(value: undefined): undefined
export function clonePropertyDefinitionRecord(
  value: Record<string, unknown> | undefined
): Record<string, unknown> | undefined
export function clonePropertyDefinitionRecord(
  value: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  return value
    ? (clonePropertyDefinitionValue(value) as Record<string, unknown>)
    : undefined
}
