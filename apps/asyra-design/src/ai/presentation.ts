import type { AiConversationOutcome, AiSettledTurn } from './conversation'
import { AiActionNames, AiDrawingDetailOptionIds } from '../constants'

export interface AiTurnSummary {
  readonly durationLabel: string
  readonly message: string
  readonly outcome: AiConversationOutcome
}

export type AiDrawingDetailOptionId =
  (typeof AiDrawingDetailOptionIds)[keyof typeof AiDrawingDetailOptionIds]

export interface AiDrawingDetailChoice {
  readonly description: string
  readonly elementCount: number
  readonly id: AiDrawingDetailOptionId
  readonly label: string
  readonly pointCountLabel: string
  readonly resourceWarning: string | null
}

export interface AiDrawingDetailChoiceProjection {
  readonly choices: readonly AiDrawingDetailChoice[]
  readonly kind: 'drawing-detail'
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const DRAWING_DETAIL_CHOICE_PROJECTION: AiDrawingDetailChoiceProjection =
  Object.freeze({
    choices: Object.freeze([
      Object.freeze({
        description: 'Faster and lighter for editing.',
        elementCount: 7_111,
        id: AiDrawingDetailOptionIds.BALANCED,
        label: 'Balanced detail',
        pointCountLabel: 'At least 115,000 points',
        resourceWarning: null
      }),
      Object.freeze({
        description: 'Uses the highest live-validated vector detail.',
        elementCount: 27_471,
        id: AiDrawingDetailOptionIds.MAXIMUM,
        label: 'Maximum detail',
        pointCountLabel: '295,794 points',
        resourceWarning:
          'May temporarily use much more memory and reduce app responsiveness.'
      })
    ]),
    kind: 'drawing-detail'
  })

export const projectAiDrawingDetailChoice = (
  turn: AiSettledTurn
): AiDrawingDetailChoiceProjection | null => {
  if (
    turn.outcome !== 'no-change' ||
    !isPlainObject(turn.result) ||
    turn.result.status !== 'executed' ||
    !Array.isArray(turn.result.actionResults) ||
    turn.result.actionResults.length !== 1
  ) {
    return null
  }
  const actionResult = turn.result.actionResults[0]
  if (
    !isPlainObject(actionResult) ||
    actionResult.actionName !== AiActionNames.REQUEST_DRAWING_DETAIL_CHOICE ||
    !isPlainObject(actionResult.result)
  ) {
    return null
  }
  const result = actionResult.result
  if (
    result.action !== AiActionNames.REQUEST_DRAWING_DETAIL_CHOICE ||
    result.status !== 'no-change' ||
    !isPlainObject(result.clarification) ||
    result.clarification.kind !== 'drawing-detail' ||
    !Array.isArray(result.clarification.optionIds) ||
    result.clarification.optionIds.length !== 2 ||
    result.clarification.optionIds[0] !== AiDrawingDetailOptionIds.BALANCED ||
    result.clarification.optionIds[1] !== AiDrawingDetailOptionIds.MAXIMUM
  ) {
    return null
  }
  return DRAWING_DETAIL_CHOICE_PROJECTION
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

const formatElapsedTime = (durationMs: number): string => {
  const seconds = Math.max(0, durationMs) / 1_000
  if (seconds < 10) {
    return `Elapsed ${Math.max(0.1, seconds).toFixed(1)}s`
  }

  const roundedSeconds = Math.round(seconds)
  if (roundedSeconds < 60) {
    return `Elapsed ${roundedSeconds}s`
  }

  const minutes = Math.floor(roundedSeconds / 60)
  const remainingSeconds = roundedSeconds % 60
  if (minutes < 60) {
    return `Elapsed ${minutes}m ${remainingSeconds}s`
  }

  const hours = Math.floor(minutes / 60)
  return `Elapsed ${hours}h ${minutes % 60}m ${remainingSeconds}s`
}

export const summarizeAiTurn = (turn: AiSettledTurn): AiTurnSummary => {
  let message = 'The request failed without applying changes.'
  if (projectAiDrawingDetailChoice(turn)) {
    message = 'Choose a drawing detail level.'
  } else if (turn.outcome === 'success') {
    message = 'Drawing updated successfully.'
  } else if (turn.outcome === 'partial') {
    const counts = partialCounts(turn.result)
    message = `Partially updated the drawing: ${counts.applied} applied, ${counts.skipped} skipped.`
  } else if (turn.outcome === 'no-change') {
    message = 'No canvas changes were needed.'
  } else if (turn.outcome === 'cancelled') {
    message = 'The request was cancelled.'
  }
  return Object.freeze({
    durationLabel: formatElapsedTime(turn.durationMs),
    message,
    outcome: turn.outcome
  })
}
