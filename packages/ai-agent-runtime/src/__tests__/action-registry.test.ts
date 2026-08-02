import { describe, expect, it, vi } from 'vitest'
import {
  AiActionRegistryError,
  createAiActionRegistry,
  type AiActionDefinition
} from '..'

interface ResizeArgs {
  width: number
}

const inputSchema = () => ({
  additionalProperties: false,
  properties: {
    width: {
      type: 'number'
    }
  },
  required: ['width'],
  type: 'object'
})

const action = (
  name: string,
  schema: unknown = inputSchema()
): AiActionDefinition<ResizeArgs, { resized: true }> => ({
  description: `Execute ${name}`,
  execute: vi.fn(
    async (): Promise<{ resized: true }> => ({
      resized: true
    })
  ),
  inputSchema: schema,
  name
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
  it('lists detached immutable backend-facing input schemas in registration order', () => {
    const schema = inputSchema()
    const first = action('resize', schema)
    const registry = createAiActionRegistry()

    registry.register(first)
    registry.register(action('rotate'))
    schema.properties.width.type = 'string'
    first.description = 'mutated after registration'

    const descriptions = registry.list()

    expect(descriptions).toEqual([
      {
        description: 'Execute resize',
        inputSchema: {
          additionalProperties: false,
          properties: {
            width: {
              type: 'number'
            }
          },
          required: ['width'],
          type: 'object'
        },
        name: 'resize'
      },
      {
        description: 'Execute rotate',
        inputSchema: inputSchema(),
        name: 'rotate'
      }
    ])
    expect('execute' in descriptions[0]).toBe(false)
    expect('schema' in descriptions[0]).toBe(false)
    expect(Object.isFrozen(descriptions)).toBe(true)
    expect(Object.isFrozen(descriptions[0])).toBe(true)
    expect(Object.isFrozen(descriptions[0].inputSchema)).toBe(true)
  })

  it('registers only the input schema and executor without a client schema surface', () => {
    const registry = createAiActionRegistry()
    const resize = action('resize')

    registry.register(resize)

    const registered = registry.get('resize')
    expect(registered).toEqual({
      description: 'Execute resize',
      execute: resize.execute,
      inputSchema: inputSchema(),
      name: 'resize'
    })
    expect(registered).not.toHaveProperty('schema')
    expect(registered).not.toHaveProperty('parse')
    expect(registered).not.toHaveProperty('prepare')
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
      () => registry.register(action('cyclic-schema', cyclicSchema)),
      'AI_ACTION_INVALID_INPUT_SCHEMA'
    )
    expectRegistryError(() => registry.list(), 'AI_ACTION_REGISTRY_EMPTY')
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
