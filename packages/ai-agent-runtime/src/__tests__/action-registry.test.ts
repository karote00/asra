import { describe, expect, it, vi } from 'vitest'
import {
  AiActionRegistryError,
  createAiActionRegistry,
  type AiActionDefinition,
  type AiActionSchema
} from '..'

interface ResizeArgs {
  width: number
}

const resizeSchema = (): AiActionSchema<ResizeArgs> => ({
  providerSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['width'],
    properties: {
      width: {
        type: 'number'
      }
    }
  },
  parse(value) {
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { width?: unknown }).width === 'number'
    ) {
      return {
        success: true,
        value: {
          width: (value as { width: number }).width
        }
      }
    }

    return {
      success: false,
      issues: [
        {
          code: 'invalid_width',
          message: 'width must be a number',
          path: ['width']
        }
      ]
    }
  }
})

const action = (
  name: string,
  schema: AiActionSchema<ResizeArgs> = resizeSchema()
): AiActionDefinition<ResizeArgs, { resized: true }> => ({
  name,
  description: `Execute ${name}`,
  schema,
  execute: vi.fn(
    async (): Promise<{ resized: true }> => ({
      resized: true
    })
  )
})

const expectRegistryError = (
  execute: () => unknown,
  code: AiActionRegistryError['code']
) => {
  expect(execute).toThrowError(
    expect.objectContaining({
      code
    })
  )
}

describe('AI action registry', () => {
  it('lists detached immutable provider-safe descriptions in registration order', () => {
    const providerSchema = {
      type: 'object',
      properties: {
        width: {
          type: 'number'
        }
      }
    }
    const schema: AiActionSchema<ResizeArgs> = {
      ...resizeSchema(),
      providerSchema
    }
    const first = action('resize', schema)
    const registry = createAiActionRegistry()

    registry.register(first)
    registry.register(action('rotate'))
    providerSchema.properties.width.type = 'string'
    first.description = 'mutated after registration'

    const descriptions = registry.list()

    expect(descriptions).toEqual([
      {
        name: 'resize',
        description: 'Execute resize',
        inputSchema: {
          type: 'object',
          properties: {
            width: {
              type: 'number'
            }
          }
        }
      },
      {
        name: 'rotate',
        description: 'Execute rotate',
        inputSchema: resizeSchema().providerSchema
      }
    ])
    expect('execute' in descriptions[0]).toBe(false)
    expect('schema' in descriptions[0]).toBe(false)
    expect(Object.isFrozen(descriptions)).toBe(true)
    expect(Object.isFrozen(descriptions[0])).toBe(true)
    expect(Object.isFrozen(descriptions[0].inputSchema)).toBe(true)
  })

  it('rejects duplicate names without replacing the original action', () => {
    const registry = createAiActionRegistry()
    const original = action('resize')
    const duplicate = action('resize')

    registry.register(original)

    expectRegistryError(
      () => registry.register(duplicate),
      'AI_ACTION_DUPLICATE'
    )
    expect(registry.get('resize')?.execute).toBe(original.execute)
    expect(registry.list()).toHaveLength(1)
  })

  it('rejects invalid definitions before changing the registry', () => {
    const registry = createAiActionRegistry()
    const cyclicSchema: Record<string, unknown> = {}
    cyclicSchema.self = cyclicSchema

    expectRegistryError(
      () => registry.register(action('   ')),
      'AI_ACTION_INVALID_NAME'
    )
    expectRegistryError(
      () =>
        registry.register({
          ...action('missing-description'),
          description: ' '
        }),
      'AI_ACTION_INVALID_DESCRIPTION'
    )
    expectRegistryError(
      () =>
        registry.register(
          action('cyclic-schema', {
            ...resizeSchema(),
            providerSchema: cyclicSchema
          })
        ),
      'AI_ACTION_INVALID_SCHEMA'
    )
    expectRegistryError(() => registry.list(), 'AI_ACTION_REGISTRY_EMPTY')
  })

  it('keeps schema parsing strict and executor resolution inside the registry', () => {
    const registry = createAiActionRegistry()

    registry.register(action('resize'))

    expect(registry.get('resize')?.schema.parse({ width: 20 })).toEqual({
      success: true,
      value: {
        width: 20
      }
    })
    expect(registry.get('resize')?.schema.parse({ width: '20' })).toEqual({
      success: false,
      issues: [
        {
          code: 'invalid_width',
          message: 'width must be a number',
          path: ['width']
        }
      ]
    })
    expect(registry.get('unknown')).toBeUndefined()
  })

  it('isolates registrations and disposal between registry instances', () => {
    const first = createAiActionRegistry()
    const second = createAiActionRegistry()

    first.register(action('resize'))
    first.dispose()

    expectRegistryError(
      () => first.get('resize'),
      'AI_ACTION_REGISTRY_DISPOSED'
    )
    expectRegistryError(
      () => first.register(action('rotate')),
      'AI_ACTION_REGISTRY_DISPOSED'
    )
    expectRegistryError(() => second.list(), 'AI_ACTION_REGISTRY_EMPTY')
  })
})
