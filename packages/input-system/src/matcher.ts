import { InputKey } from '@asra/utils'

/**
 * Checks if the currently active keys match a given combination.
 * The order of keys does not matter.
 *
 * @param keys - A Set of currently active keys (KeyboardKey | ModifierKey).
 * @param combo - A list of keys that form a combination.
 */
export function matchActive(keys: Set<InputKey>, combo: InputKey[]): boolean {
  if (combo.length === 0) return false
  for (const key of combo) {
    if (!keys.has(key)) return false
  }
  return true
}

/**
 * Checks if the recent key sequence ends with a specific ordered pattern.
 *
 * @param sequence - The full recent key sequence (e.g., for chord shortcuts).
 * @param pattern - The ordered pattern to match.
 */
export function matchSequence(
  sequence: InputKey[],
  pattern: InputKey[]
): boolean {
  if (sequence.length < pattern.length) return false
  const start = sequence.length - pattern.length
  for (let i = 0; i < pattern.length; i++) {
    if (sequence[start + i] !== pattern[i]) return false
  }
  return true
}
