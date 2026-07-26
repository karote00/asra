import type {
  AsyraDesignAiConversationOutcome,
  AsyraDesignAiSettledTurn
} from './conversation'

export interface AsyraDesignAiTurnSummary {
  readonly message: string
  readonly outcome: AsyraDesignAiConversationOutcome
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const partialCounts = (
  result: unknown
): {
  applied: number
  skipped: number
} => {
  if (!isPlainObject(result) || !Array.isArray(result.actionResults)) {
    return {
      applied: 0,
      skipped: 0
    }
  }
  return result.actionResults.reduce(
    (counts, action) => {
      if (!isPlainObject(action) || !isPlainObject(action.result)) {
        return counts
      }
      return {
        applied:
          counts.applied +
          (Array.isArray(action.result.appliedElementIds)
            ? action.result.appliedElementIds.length
            : 0),
        skipped:
          counts.skipped +
          (Array.isArray(action.result.skipped)
            ? action.result.skipped.length
            : 0)
      }
    },
    {
      applied: 0,
      skipped: 0
    }
  )
}

export const summarizeAsyraDesignAiTurn = (
  turn: AsyraDesignAiSettledTurn
): AsyraDesignAiTurnSummary => {
  let message = 'The request failed without applying changes.'
  if (turn.outcome === 'success') {
    message = 'Drawing updated successfully.'
  } else if (turn.outcome === 'partial') {
    const counts = partialCounts(turn.result)
    message = `Partially updated the drawing: ${counts.applied} applied, ${counts.skipped} skipped.`
  } else if (turn.outcome === 'no-change') {
    message = 'No canvas changes were needed.'
  } else if (turn.outcome === 'cancelled') {
    message = 'The request was cancelled.'
  } else if (turn.outcome === 'unavailable') {
    message = 'Mock AI is unavailable.'
  }
  return Object.freeze({
    message,
    outcome: turn.outcome
  })
}
