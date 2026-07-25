import type {
  AiActionDefinition,
  AiActionSchemaIssue,
  AiActionSchemaResult,
  AiExecutionContext
} from '@asyra/ai-agent-runtime'
import type { EVENT_OPTIONS } from '@asyra/utils'
import { elementApis, selectionApis } from '../common-apis'

export const AsyraDesignAiActionNames = Object.freeze({
  SET_ELEMENT_VISIBILITY: 'set_element_visibility',
  SELECT_ELEMENTS: 'select_elements'
} as const)

export const ASYRA_DESIGN_AI_SELECTION_LIMIT = 100

const AI_MUTATION_OPTIONS: EVENT_OPTIONS = Object.freeze({
  sharedDelivery: 'transaction-end',
  undoable: true
})

export interface SetElementVisibilityArgs {
  readonly elementId: string
  readonly visible: boolean
}

export interface SelectElementsArgs {
  readonly elementIds: readonly string[]
}

export interface AsyraDesignAiActionApis {
  setElementVisible(
    elementId: string,
    visible: boolean,
    options?: EVENT_OPTIONS
  ): boolean
  selectElements(elementIds: string[], options?: EVENT_OPTIONS): void
}

export class AsyraDesignAiActionError extends Error {
  readonly code = 'AI_APP_ACTION_ABORTED' as const

  constructor() {
    super('Asyra Design AI action was aborted.')
    this.name = 'AsyraDesignAiActionError'
  }
}

const defaultApis: AsyraDesignAiActionApis = {
  setElementVisible: (elementId, visible, options) =>
    elementApis.setElementVisible(elementId, visible, options),
  selectElements: (elementIds, options) =>
    selectionApis.selectElements(elementIds, options)
}

const invalidArguments = (
  code: string,
  path: readonly (number | string)[]
): AiActionSchemaResult<never> => {
  const issue: AiActionSchemaIssue = Object.freeze({
    code,
    message: 'Action arguments do not match the registered schema.',
    path: Object.freeze([...path])
  })
  return Object.freeze({
    success: false,
    issues: Object.freeze([issue])
  })
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const readExactObject = (
  value: unknown,
  keys: readonly string[]
): Record<string, unknown> | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const ownKeys = Reflect.ownKeys(value)
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))
  ) {
    return null
  }

  const result: Record<string, unknown> = {}
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      return null
    }
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value: descriptor.value,
      writable: true
    })
  }
  return result
}

const parseVisibility = (
  value: unknown
): AiActionSchemaResult<SetElementVisibilityArgs> => {
  const object = readExactObject(value, ['elementId', 'visible'])
  if (
    !object ||
    typeof object.elementId !== 'string' ||
    object.elementId.trim().length === 0 ||
    typeof object.visible !== 'boolean'
  ) {
    return invalidArguments('invalid_visibility_arguments', [])
  }

  return Object.freeze({
    success: true,
    value: Object.freeze({
      elementId: object.elementId,
      visible: object.visible
    })
  })
}

const parseSelection = (
  value: unknown
): AiActionSchemaResult<SelectElementsArgs> => {
  const object = readExactObject(value, ['elementIds'])
  if (!object || !Array.isArray(object.elementIds)) {
    return invalidArguments('invalid_selection_arguments', ['elementIds'])
  }

  const elementIds: string[] = []
  const seen = new Set<string>()
  if (
    object.elementIds.length === 0 ||
    object.elementIds.length > ASYRA_DESIGN_AI_SELECTION_LIMIT
  ) {
    return invalidArguments('invalid_selection_size', ['elementIds'])
  }

  for (let index = 0; index < object.elementIds.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(
      object.elementIds,
      String(index)
    )
    if (
      !descriptor?.enumerable ||
      !('value' in descriptor) ||
      typeof descriptor.value !== 'string' ||
      descriptor.value.trim().length === 0 ||
      seen.has(descriptor.value)
    ) {
      return invalidArguments('invalid_selection_id', ['elementIds', index])
    }
    seen.add(descriptor.value)
    elementIds.push(descriptor.value)
  }

  return Object.freeze({
    success: true,
    value: Object.freeze({
      elementIds: Object.freeze(elementIds)
    })
  })
}

const assertNotAborted = (context: AiExecutionContext): void => {
  if (context.signal.aborted) {
    throw new AsyraDesignAiActionError()
  }
}

export const createAsyraDesignAiActions = (
  apis: AsyraDesignAiActionApis = defaultApis
): readonly AiActionDefinition[] => {
  const visibility: AiActionDefinition<SetElementVisibilityArgs> =
    Object.freeze({
      name: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      description: 'Set whether one existing element is visible.',
      schema: Object.freeze({
        providerSchema: Object.freeze({
          type: 'object',
          additionalProperties: false,
          required: Object.freeze(['elementId', 'visible']),
          properties: Object.freeze({
            elementId: Object.freeze({
              type: 'string',
              minLength: 1
            }),
            visible: Object.freeze({
              type: 'boolean'
            })
          })
        }),
        parse: parseVisibility
      }),
      execute: async (
        args: SetElementVisibilityArgs,
        context: AiExecutionContext
      ) => {
        assertNotAborted(context)
        const changed = apis.setElementVisible(
          args.elementId,
          args.visible,
          AI_MUTATION_OPTIONS
        )
        return Object.freeze({
          action: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
          changed,
          elementId: args.elementId
        })
      }
    })

  const selection: AiActionDefinition<SelectElementsArgs> = Object.freeze({
    name: AsyraDesignAiActionNames.SELECT_ELEMENTS,
    description: `Select from 1 to ${ASYRA_DESIGN_AI_SELECTION_LIMIT} existing elements.`,
    schema: Object.freeze({
      providerSchema: Object.freeze({
        type: 'object',
        additionalProperties: false,
        required: Object.freeze(['elementIds']),
        properties: Object.freeze({
          elementIds: Object.freeze({
            type: 'array',
            minItems: 1,
            maxItems: ASYRA_DESIGN_AI_SELECTION_LIMIT,
            uniqueItems: true,
            items: Object.freeze({
              type: 'string',
              minLength: 1
            })
          })
        })
      }),
      parse: parseSelection
    }),
    execute: async (args: SelectElementsArgs, context: AiExecutionContext) => {
      assertNotAborted(context)
      apis.selectElements([...args.elementIds], AI_MUTATION_OPTIONS)
      return Object.freeze({
        action: AsyraDesignAiActionNames.SELECT_ELEMENTS,
        selectedCount: args.elementIds.length
      })
    }
  })

  return Object.freeze([visibility, selection])
}
