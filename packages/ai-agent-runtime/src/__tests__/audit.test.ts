import { describe, expect, it, vi } from 'vitest'
import {
  AI_REDACTED_VALUE,
  createAiRuntimeAudit,
  type AiActionExecutionBatch
} from '..'

const executionBatch = (): AiActionExecutionBatch =>
  Object.freeze({
    actionResults: Object.freeze([
      Object.freeze({
        actionId: 'action-1',
        actionName: 'set_element_visibility',
        result: Object.freeze({
          changed: true,
          nested: Object.freeze({
            apiKey: 'executor-secret'
          })
        })
      }),
      Object.freeze({
        actionId: 'action-2',
        actionName: 'select_elements',
        result: Object.freeze({
          selectedCount: 2
        })
      })
    ])
  })

describe('AI runtime audit output', () => {
  it('returns one detached immutable ordered execution audit', () => {
    const batch = executionBatch()
    const audit = createAiRuntimeAudit({
      actionResults: batch.actionResults,
      explanation: 'Apply the requested changes.',
      outcome: 'executed',
      planId: 'plan-1',
      retryCount: 1
    })

    expect(audit).toEqual({
      planId: 'plan-1',
      outcome: 'executed',
      retryCount: 1,
      explanation: 'Apply the requested changes.',
      actions: [
        {
          actionId: 'action-1',
          actionName: 'set_element_visibility',
          result: {
            changed: true,
            nested: {
              apiKey: AI_REDACTED_VALUE
            }
          }
        },
        {
          actionId: 'action-2',
          actionName: 'select_elements',
          result: {
            selectedCount: 2
          }
        }
      ]
    })
    expect(Object.isFrozen(audit)).toBe(true)
    expect(Object.isFrozen(audit.actions)).toBe(true)
    expect(Object.isFrozen(audit.actions[0])).toBe(true)
    expect(audit.actions[0]).not.toBe(batch.actionResults[0])
  })

  it('redacts configured keys and authorization-like explanation values', () => {
    const audit = createAiRuntimeAudit(
      {
        actionResults: [
          {
            actionId: 'action-1',
            actionName: 'custom_action',
            result: {
              internalCredential: 'private-value'
            }
          }
        ],
        explanation: 'Bearer provider-secret',
        outcome: 'failed',
        planId: 'plan-1',
        retryCount: 2
      },
      {
        additionalSecretKeys: ['internalCredential']
      }
    )

    expect(audit.explanation).toBe(AI_REDACTED_VALUE)
    expect(audit.actions[0]?.result).toEqual({
      internalCredential: AI_REDACTED_VALUE
    })
  })

  it('never invokes accessors while detaching audit summaries', () => {
    const getter = vi.fn(() => 'provider-secret')
    const result: unknown[] = []
    Object.defineProperty(result, '0', {
      enumerable: true,
      get: getter
    })
    result.length = 1

    const audit = createAiRuntimeAudit({
      actionResults: [
        {
          actionId: 'action-1',
          actionName: 'custom_action',
          result
        } as never
      ],
      outcome: 'failed',
      retryCount: 0
    })

    expect(getter).not.toHaveBeenCalled()
    expect(audit.actions[0]?.result).toEqual([AI_REDACTED_VALUE])
  })
})
