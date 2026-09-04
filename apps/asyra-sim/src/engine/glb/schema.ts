export const GLB_LIMITS = Object.freeze({
  bytes: 16 * 1024 * 1024,
  jsonBytes: 2 * 1024 * 1024,
  nodes: 128,
  meshes: 64,
  primitives: 256,
  vertices: 200000,
  indices: 600000,
  coordinate: 1000,
  jsonDepth: 24,
  jsonValues: 50000
})
export type JsonRecord = Record<string, unknown>
export function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Invalid ${label}`)
  return value as JsonRecord
}
export function list(
  value: unknown,
  label: string,
  max: number,
  min = 0
): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw new Error(`Invalid or over-budget ${label}`)
  return value
}
export function integer(
  value: unknown,
  label: string,
  max: number,
  min = 0
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error(`Invalid ${label}`)
  return value
}
export function tuple(value: unknown, length: number, label: string): number[] {
  const values = list(value, label, length, length)
  if (!values.every((v) => typeof v === 'number' && Number.isFinite(v)))
    throw new Error(`Nonfinite ${label}`)
  return values as number[]
}
export function name(value: unknown, fallback: string): string {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || value.length > 200)
    throw new Error('Invalid asset name')
  return value
}
const forbidden = new Set([
  'uri',
  'extensions',
  'extensionsUsed',
  'extensionsRequired',
  'images',
  'textures',
  'samplers',
  'animations',
  'skins',
  'skin',
  'weights',
  'targets',
  'sparse',
  'cameras',
  'camera',
  '__proto__',
  'prototype',
  'constructor'
])
/** Reject active/unsupported features anywhere, including otherwise unused metadata. */
export function inspectJson(input: unknown): void {
  const pending = [{ value: input, depth: 0 }]
  let count = 0
  while (pending.length) {
    const item = pending.pop()
    if (!item) break
    if (++count > GLB_LIMITS.jsonValues || item.depth > GLB_LIMITS.jsonDepth)
      throw new Error('GLB JSON resource limit exceeded')
    if (item.value && typeof item.value === 'object')
      for (const [key, value] of Object.entries(item.value)) {
        if (forbidden.has(key) || key.endsWith('Texture'))
          throw new Error(`Unsupported GLB feature: ${key}`)
        pending.push({ value, depth: item.depth + 1 })
      }
  }
}
