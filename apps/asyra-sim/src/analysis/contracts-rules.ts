import { hasExactOwnKeys, isPlainRecord } from '../domain/records'

export type AcceptanceExpression =
  | { kind: 'clearance'; operator: 'above' | 'below'; value: number }
  | { kind: 'penetration'; expected: 'present' | 'absent' }
  | { kind: 'all' | 'any'; conditions: readonly AcceptanceExpression[] }

export const ACCEPTANCE_LIMITS = Object.freeze({
  depth: 4,
  nodes: 31,
  children: 8
})

export function validateAcceptanceExpression(
  input: unknown
): asserts input is AcceptanceExpression {
  const ancestors = new Set<object>()
  let nodes = 0
  const visit = (value: unknown, depth: number): void => {
    if (
      !isPlainRecord(value) ||
      depth > ACCEPTANCE_LIMITS.depth ||
      ++nodes > ACCEPTANCE_LIMITS.nodes ||
      ancestors.has(value)
    )
      throw new Error('Invalid or over-budget acceptance expression')
    if (value.kind === 'clearance') {
      if (
        !hasExactOwnKeys(value, ['kind', 'operator', 'value']) ||
        (value.operator !== 'above' && value.operator !== 'below') ||
        typeof value.value !== 'number' ||
        !Number.isFinite(value.value) ||
        value.value < 0 ||
        value.value > 20
      )
        throw new Error('Invalid acceptance clearance predicate')
    } else if (value.kind === 'penetration') {
      if (
        !hasExactOwnKeys(value, ['kind', 'expected']) ||
        (value.expected !== 'present' && value.expected !== 'absent')
      )
        throw new Error('Invalid acceptance penetration predicate')
    } else if (value.kind === 'all' || value.kind === 'any') {
      if (
        !hasExactOwnKeys(value, ['kind', 'conditions']) ||
        !Array.isArray(value.conditions) ||
        value.conditions.length < 2 ||
        value.conditions.length > ACCEPTANCE_LIMITS.children
      )
        throw new Error('Invalid acceptance group')
      ancestors.add(value)
      for (const child of value.conditions) visit(child, depth + 1)
      ancestors.delete(value)
    } else throw new Error('Unsupported acceptance predicate')
  }
  visit(input, 1)
}
