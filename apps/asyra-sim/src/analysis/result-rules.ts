import { hasExactOwnKeys } from '../domain/records'
import type { MethodPairEvidence } from '../extensions/contracts'
import {
  validateAcceptanceExpression,
  type AcceptanceExpression
} from './contracts-rules'

export type RuleTruth = 'true' | 'false' | 'unknown'
export interface RuleEvaluation {
  value: RuleTruth
  reason: string
  children?: readonly RuleEvaluation[]
}

/** Result-owner operation: callers supply already validated pair evidence. */
export function evaluateAcceptance(
  expression: AcceptanceExpression,
  totalPairs: number,
  pairs: readonly MethodPairEvidence[]
): RuleEvaluation {
  validateAcceptanceExpression(expression)
  const lower =
    pairs.length === totalPairs && totalPairs > 0
      ? pairs.reduce(
          (minimum, pair) => Math.min(minimum, pair.evidence.lower),
          Infinity
        )
      : 0
  const upper = pairs.reduce<number | null>((minimum, pair) => {
    const bound = pair.evidence.upper
    if (bound === null) return minimum
    return minimum === null ? bound : Math.min(minimum, bound)
  }, null)
  const penetration = pairs.some((pair) =>
    pair.evidence.leaves.some((leaf) => leaf.penetration)
  )
  const evaluate = (node: AcceptanceExpression): RuleEvaluation => {
    if (node.kind === 'all' || node.kind === 'any') {
      const children = node.conditions.map(evaluate)
      const decisive = node.kind === 'all' ? 'false' : 'true'
      const uniform = node.kind === 'all' ? 'true' : 'false'
      let value: RuleTruth = 'unknown'
      if (children.some((child) => child.value === decisive)) value = decisive
      else if (children.every((child) => child.value === uniform))
        value = uniform
      return {
        value,
        reason: `${node.kind === 'all' ? 'AND' : 'OR'} of retained child evaluations; unknown evidence is not discarded.`,
        children
      }
    }
    if (node.kind === 'penetration') {
      let presence: RuleTruth = 'unknown'
      if (penetration) presence = 'true'
      else if (lower > 0) presence = 'false'
      let value = presence
      if (node.expected === 'absent' && presence !== 'unknown')
        value = presence === 'true' ? 'false' : 'true'
      let reason =
        'neither penetration nor separation is established for the full scope'
      if (penetration) reason = 'a validated penetration witness exists'
      else if (lower > 0)
        reason = 'all queried pairs have strictly positive separation bounds'
      return {
        value,
        reason: `Penetration expected ${node.expected}; ${reason}.`
      }
    }
    if (node.kind === 'clearance') {
      let value: RuleTruth = 'unknown'
      if (node.operator === 'above') {
        if (lower > node.value) value = 'true'
        else if (upper !== null && upper <= node.value) value = 'false'
      } else {
        if (upper !== null && upper < node.value) value = 'true'
        else if (lower >= node.value) value = 'false'
      }
      return {
        value,
        reason: `Minimum clearance bounds [${lower}, ${upper === null ? 'unknown' : upper}] m; strictly ${node.operator} ${node.value} m.`
      }
    }
    throw new Error('Unsupported acceptance predicate')
  }
  return evaluate(expression)
}

/** Bound untrusted historical trees by the already validated expression shape. */
export function validateRuleEvaluation(
  input: unknown,
  expression: AcceptanceExpression
): void {
  validateAcceptanceExpression(expression)
  const visit = (value: unknown, node: AcceptanceExpression): void => {
    const group = node.kind === 'all' || node.kind === 'any'
    if (
      !hasExactOwnKeys(value, [
        'value',
        'reason',
        ...(group ? ['children'] : [])
      ]) ||
      typeof value.value !== 'string' ||
      !['true', 'false', 'unknown'].includes(value.value) ||
      typeof value.reason !== 'string' ||
      value.reason.length === 0 ||
      value.reason.length > 1000
    )
      throw new Error('Invalid retained rule evaluation')
    if (node.kind === 'all' || node.kind === 'any') {
      const children = value.children
      if (
        !Array.isArray(children) ||
        children.length !== node.conditions.length
      )
        throw new Error('Invalid retained rule evaluation children')
      node.conditions.forEach((child, index) => visit(children[index], child))
    }
  }
  visit(input, expression)
}
