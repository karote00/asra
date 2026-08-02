import type { AiContextProvider } from '@asyra/ai-agent-runtime'
import {
  elementApis,
  hierarchyApis,
  selectionApis,
  systemContextApis
} from '../common-apis'
import {
  ASYRA_DESIGN_AI_APP_PROMPT,
  ASYRA_DESIGN_AI_IMAGE_TOOL_CATALOG,
  type AsyraDesignAiImageToolDescriptor
} from './app-prompt'

export const AI_CONTEXT_SELECTED_ELEMENT_LIMIT = 50

export type AiContextCollectionErrorCode =
  | 'AI_CONTEXT_ABORTED'
  | 'AI_CONTEXT_INVALID_INTENT'

export class AiContextCollectionError extends Error {
  readonly code: AiContextCollectionErrorCode

  constructor(code: AiContextCollectionErrorCode) {
    super(
      code === 'AI_CONTEXT_ABORTED'
        ? 'AI context collection was aborted'
        : 'AI context collection requires a non-empty intent'
    )
    this.name = 'AiContextCollectionError'
    this.code = code
  }
}

export interface AsyraDesignAiElementBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface AsyraDesignAiElementContext {
  readonly id: string
  readonly type: string
  readonly visible: boolean
  readonly locked: boolean
  readonly bounds: AsyraDesignAiElementBounds | null
}

export interface AsyraDesignAiContext {
  readonly app: 'asyra-design'
  readonly appPrompt: string
  readonly imageTools: readonly AsyraDesignAiImageToolDescriptor[]
  readonly workspaceId: string | null
  readonly primaryTool: string
  readonly systemMode: string
  readonly elementCount: number
  readonly selectedElementCount: number
  readonly selectedElements: readonly AsyraDesignAiElementContext[]
}

type MaybePromise<T> = T | Promise<T>

export interface AsyraDesignAiElementContextSource {
  readonly id?: unknown
  readonly type?: unknown
  readonly visible?: unknown
  readonly locked?: unknown
  readonly bounds?: unknown
  readonly [key: string]: unknown
}

export interface AsyraDesignAiContextQueries {
  getSelectedElementIds(): MaybePromise<readonly string[]>
  getWorkspaceId(): MaybePromise<string | null>
  getElementCount(): MaybePromise<number>
  getSystemSnapshot(): MaybePromise<Record<string, unknown>>
  getElementSummary(
    elementId: string
  ): MaybePromise<AsyraDesignAiElementContextSource>
}

const defaultQueries: AsyraDesignAiContextQueries = {
  getSelectedElementIds: () => selectionApis.getSelectedIds(),
  getWorkspaceId: () => hierarchyApis.getWorkspaceId(),
  getElementCount: () => hierarchyApis.getFlattenedElementIds().length,
  getSystemSnapshot: () => systemContextApis.getSystemContextSnapshot(),
  getElementSummary: (elementId) => ({
    id: elementId,
    type: elementApis.getElementType(elementId),
    visible: elementApis.isElementVisible(elementId),
    locked: elementApis.isElementLocked(elementId),
    bounds: elementApis.getElementBounds(elementId)
  })
}

const assertNotAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new AiContextCollectionError('AI_CONTEXT_ABORTED')
  }
}

const toBounds = (value: unknown): AsyraDesignAiElementBounds | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const bounds = value as Record<string, unknown>
  const values = [bounds.x, bounds.y, bounds.width, bounds.height]
  if (
    values.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))
  ) {
    return null
  }
  return Object.freeze({
    x: bounds.x as number,
    y: bounds.y as number,
    width: bounds.width as number,
    height: bounds.height as number
  })
}

const toElementContext = (
  elementId: string,
  source: AsyraDesignAiElementContextSource
): AsyraDesignAiElementContext =>
  Object.freeze({
    id: elementId,
    type: typeof source.type === 'string' ? source.type : 'unknown',
    visible: source.visible !== false,
    locked: source.locked === true,
    bounds: toBounds(source.bounds)
  })

export const createAsyraDesignAiContextProvider = (
  queries: AsyraDesignAiContextQueries = defaultQueries
) => {
  const provider = {
    getContext: async ({
      intent,
      signal
    }: {
      intent: string
      signal: AbortSignal
    }): Promise<AsyraDesignAiContext> => {
      if (!intent.trim()) {
        throw new AiContextCollectionError('AI_CONTEXT_INVALID_INTENT')
      }
      assertNotAborted(signal)

      const [
        selectedElementIdsValue,
        workspaceIdValue,
        elementCountValue,
        systemSnapshot
      ] = await Promise.all([
        queries.getSelectedElementIds(),
        queries.getWorkspaceId(),
        queries.getElementCount(),
        queries.getSystemSnapshot()
      ])
      assertNotAborted(signal)

      const selectedElementIds = selectedElementIdsValue.filter(
        (elementId): elementId is string =>
          typeof elementId === 'string' && elementId.length > 0
      )
      const selectedElements = await Promise.all(
        selectedElementIds
          .slice(0, AI_CONTEXT_SELECTED_ELEMENT_LIMIT)
          .map(async (elementId) =>
            toElementContext(
              elementId,
              await queries.getElementSummary(elementId)
            )
          )
      )
      assertNotAborted(signal)

      return Object.freeze({
        app: 'asyra-design',
        appPrompt: ASYRA_DESIGN_AI_APP_PROMPT,
        imageTools: ASYRA_DESIGN_AI_IMAGE_TOOL_CATALOG,
        workspaceId:
          typeof workspaceIdValue === 'string' && workspaceIdValue.length > 0
            ? workspaceIdValue
            : null,
        primaryTool:
          typeof systemSnapshot.primaryTool === 'string'
            ? systemSnapshot.primaryTool
            : 'unknown',
        systemMode:
          typeof systemSnapshot.systemMode === 'string'
            ? systemSnapshot.systemMode
            : 'unknown',
        elementCount:
          Number.isInteger(elementCountValue) && elementCountValue >= 0
            ? elementCountValue
            : 0,
        selectedElementCount: selectedElementIds.length,
        selectedElements: Object.freeze(selectedElements)
      })
    }
  }

  return provider satisfies AiContextProvider
}
