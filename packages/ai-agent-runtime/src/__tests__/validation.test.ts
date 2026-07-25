import { describe, expect, it, vi } from 'vitest'
import {
  AI_REDACTED_VALUE,
  AiPlanValidationError,
  createAiActionRegistry,
  normalizeAiProviderOutput,
  validateAiPlan,
  type AiActionSchema,
  type AiActionSchemaResult
} from '..'

interface ResizeArgs {
  width: number
}

const schema = (
  parse: (value: unknown) => AiActionSchemaResult<ResizeArgs>
): AiActionSchema<ResizeArgs> => ({
  providerSchema: {
    type: 'object'
  },
  parse
})

const plan = (
  actions: readonly {
    id: string
    name: string
    arguments: unknown
  }[]
) =>
  normalizeAiProviderOutput({
    planId: 'plan-1',
    explanation: 'Prepare the requested edits',
    actions
  })

const registerResize = (
  parse: (value: unknown) => AiActionSchemaResult<ResizeArgs>
) => {
  const registry = createAiActionRegistry()
  const execute = vi.fn(async () => ({
    resized: true
  }))
  registry.register({
    name: 'resize',
    description: 'Resize an element',
    schema: schema(parse),
    execute
  })
  return {
    execute,
    registry
  }
}

describe('complete AI plan validation', () => {
  it('returns one detached immutable prepared plan after every schema succeeds', () => {
    const parsedResize = {
      width: 120
    }
    const resizeParse = vi.fn(() => ({
      success: true as const,
      value: parsedResize
    }))
    const rotateParse = vi.fn(() => ({
      success: true as const,
      value: {
        width: 45
      }
    }))
    const { execute: resize, registry } = registerResize(resizeParse)
    const rotate = vi.fn(async () => ({
      rotated: true
    }))
    registry.register({
      name: 'rotate',
      description: 'Rotate an element',
      schema: schema(rotateParse),
      execute: rotate
    })

    const prepared = validateAiPlan(
      plan([
        {
          id: 'action-1',
          name: 'resize',
          arguments: {
            width: 120
          }
        },
        {
          id: 'action-2',
          name: 'rotate',
          arguments: {
            width: 45
          }
        }
      ]),
      registry
    )
    parsedResize.width = 999

    expect(prepared).toMatchObject({
      planId: 'plan-1',
      explanation: 'Prepare the requested edits',
      actions: [
        {
          id: 'action-1',
          name: 'resize',
          arguments: {
            width: 120
          },
          execute: resize
        },
        {
          id: 'action-2',
          name: 'rotate',
          arguments: {
            width: 45
          },
          execute: rotate
        }
      ]
    })
    expect(Object.isFrozen(prepared)).toBe(true)
    expect(Object.isFrozen(prepared.actions)).toBe(true)
    expect(Object.isFrozen(prepared.actions[0].arguments)).toBe(true)
    expect(resize).not.toHaveBeenCalled()
    expect(rotate).not.toHaveBeenCalled()
  })

  it('rejects an unknown action before parsing any valid prefix', () => {
    const resizeParse = vi.fn(() => ({
      success: true as const,
      value: {
        width: 120
      }
    }))
    const { execute, registry } = registerResize(resizeParse)

    expect(() =>
      validateAiPlan(
        plan([
          {
            id: 'action-1',
            name: 'resize',
            arguments: {
              width: 120
            }
          },
          {
            id: 'action-2',
            name: 'model_supplied_executor',
            arguments: {}
          }
        ]),
        registry
      )
    ).toThrowError(
      expect.objectContaining({
        code: 'AI_PLAN_UNKNOWN_ACTION',
        stage: 'validation'
      })
    )
    expect(resizeParse).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects empty plans and duplicate planned action ids before schema parsing', () => {
    const resizeParse = vi.fn(() => ({
      success: true as const,
      value: {
        width: 120
      }
    }))
    const { registry } = registerResize(resizeParse)

    expect(() => validateAiPlan(plan([]), registry)).toThrowError(
      expect.objectContaining({
        code: 'AI_PLAN_EMPTY'
      })
    )
    expect(() =>
      validateAiPlan(
        plan([
          {
            id: 'duplicate',
            name: 'resize',
            arguments: {
              width: 100
            }
          },
          {
            id: 'duplicate',
            name: 'resize',
            arguments: {
              width: 200
            }
          }
        ]),
        registry
      )
    ).toThrowError(
      expect.objectContaining({
        code: 'AI_PLAN_DUPLICATE_ACTION_ID'
      })
    )
    expect(resizeParse).not.toHaveBeenCalled()
  })

  it('rejects the complete plan when a later schema is invalid', () => {
    const resizeParse = vi.fn(() => ({
      success: true as const,
      value: {
        width: 120
      }
    }))
    const invalidParse = vi.fn(() => ({
      success: false as const,
      issues: [
        {
          code: 'invalid_width',
          message: 'Bearer schema-secret',
          path: ['width']
        }
      ]
    }))
    const { execute: resize, registry } = registerResize(resizeParse)
    const invalidExecute = vi.fn(async () => null)
    registry.register({
      name: 'invalid_resize',
      description: 'Invalid test action',
      schema: schema(invalidParse),
      execute: invalidExecute
    })

    let failure: AiPlanValidationError | undefined
    try {
      validateAiPlan(
        plan([
          {
            id: 'action-1',
            name: 'resize',
            arguments: {
              width: 120
            }
          },
          {
            id: 'action-2',
            name: 'invalid_resize',
            arguments: {
              width: 'invalid'
            }
          }
        ]),
        registry
      )
    } catch (error) {
      failure = error as AiPlanValidationError
    }

    expect(failure).toMatchObject({
      code: 'AI_PLAN_INVALID_ARGUMENTS',
      issues: [
        {
          actionId: 'action-2',
          actionName: 'invalid_resize',
          code: 'invalid_width',
          message: AI_REDACTED_VALUE,
          path: ['width']
        }
      ]
    })
    expect(Object.isFrozen(failure?.issues)).toBe(true)
    expect(resizeParse).toHaveBeenCalledOnce()
    expect(invalidParse).toHaveBeenCalledOnce()
    expect(resize).not.toHaveBeenCalled()
    expect(invalidExecute).not.toHaveBeenCalled()
  })

  it('contains thrown or malformed schema behavior without leaking raw errors', () => {
    const thrown = registerResize(() => {
      throw new Error('Bearer schema-owned-secret')
    })

    expect(() =>
      validateAiPlan(
        plan([
          {
            id: 'action-1',
            name: 'resize',
            arguments: {
              width: 120
            }
          }
        ]),
        thrown.registry
      )
    ).toThrowError(
      expect.objectContaining({
        code: 'AI_ACTION_SCHEMA_FAILED',
        message: 'Registered action schema failed.'
      })
    )

    try {
      validateAiPlan(
        plan([
          {
            id: 'action-1',
            name: 'resize',
            arguments: {
              width: 120
            }
          }
        ]),
        thrown.registry
      )
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain('schema-owned-secret')
    }

    const malformed = registerResize(
      () =>
        ({
          success: true
        }) as AiActionSchemaResult<ResizeArgs>
    )
    expect(() =>
      validateAiPlan(
        plan([
          {
            id: 'action-1',
            name: 'resize',
            arguments: {
              width: 120
            }
          }
        ]),
        malformed.registry
      )
    ).toThrowError(
      expect.objectContaining({
        code: 'AI_ACTION_SCHEMA_FAILED'
      })
    )

    const sparseIssues = registerResize(
      () =>
        ({
          success: false,
          issues: new Array(1)
        }) as AiActionSchemaResult<ResizeArgs>
    )
    expect(() =>
      validateAiPlan(
        plan([
          {
            id: 'action-1',
            name: 'resize',
            arguments: {
              width: 120
            }
          }
        ]),
        sparseIssues.registry
      )
    ).toThrowError(
      expect.objectContaining({
        code: 'AI_ACTION_SCHEMA_FAILED'
      })
    )
  })

  it('rejects non-detached values returned by a schema without invoking accessors', () => {
    const getter = vi.fn(() => 120)
    const parsed: Record<string, unknown> = {}
    Object.defineProperty(parsed, 'width', {
      enumerable: true,
      get: getter
    })
    const { registry } = registerResize(
      () =>
        ({
          success: true,
          value: parsed
        }) as unknown as AiActionSchemaResult<ResizeArgs>
    )

    expect(() =>
      validateAiPlan(
        plan([
          {
            id: 'action-1',
            name: 'resize',
            arguments: {
              width: 120
            }
          }
        ]),
        registry
      )
    ).toThrowError(
      expect.objectContaining({
        code: 'AI_ACTION_SCHEMA_FAILED'
      })
    )
    expect(getter).not.toHaveBeenCalled()

    const arrayGetter = vi.fn(() => 120)
    const parsedArray: unknown[] = []
    Object.defineProperty(parsedArray, '0', {
      enumerable: true,
      get: arrayGetter
    })
    parsedArray.length = 1
    const arrayResult = registerResize(
      () =>
        ({
          success: true,
          value: parsedArray
        }) as unknown as AiActionSchemaResult<ResizeArgs>
    )

    expect(() =>
      validateAiPlan(
        plan([
          {
            id: 'action-1',
            name: 'resize',
            arguments: {
              width: 120
            }
          }
        ]),
        arrayResult.registry
      )
    ).toThrowError(
      expect.objectContaining({
        code: 'AI_ACTION_SCHEMA_FAILED'
      })
    )
    expect(arrayGetter).not.toHaveBeenCalled()
  })
})
