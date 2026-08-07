import { describe, expect, it, vi } from 'vitest'
import {
  AI_CONTEXT_SELECTED_ELEMENT_LIMIT,
  AiContextCollectionError,
  createAiContextProvider,
  type AiContextQueries
} from '../context'
import { AI_APP_PROMPT, AI_IMAGE_TOOL_CATALOG } from '../app-prompt'

const createQueries = (
  overrides: Partial<AiContextQueries> = {}
): AiContextQueries => ({
  getSelectedElementIds: vi.fn(() => ['selected-2', 'selected-1']),
  getWorkspaceId: vi.fn(() => 'workspace-1'),
  getElementCount: vi.fn(() => 3),
  getSystemSnapshot: vi.fn(() => ({
    primaryTool: 'rectangle',
    systemMode: 'editing',
    accessToken: 'must-not-leak'
  })),
  getElementSummary: vi.fn((elementId) => ({
    id: elementId,
    type: elementId === 'selected-1' ? 'rectangle' : 'group',
    visible: true,
    locked: elementId === 'selected-2',
    bounds: { x: 10, y: 20, width: 30, height: 40 },
    props: {
      apiKey: 'must-not-leak'
    }
  })),
  ...overrides
})

describe('Design App AI context disclosure', () => {
  it('returns a detached immutable whitelist without raw props or secrets', async () => {
    const queries = createQueries()
    const provider = createAiContextProvider(queries)
    const result = await provider.getContext({
      intent: 'create a rectangle',
      signal: new AbortController().signal
    })

    expect(result).toEqual({
      appPrompt: AI_APP_PROMPT,
      imageTools: AI_IMAGE_TOOL_CATALOG,
      workspaceId: 'workspace-1',
      primaryTool: 'rectangle',
      systemMode: 'editing',
      elementCount: 3,
      selectedElementCount: 2,
      selectedElements: [
        {
          id: 'selected-2',
          type: 'group',
          visible: true,
          locked: true,
          bounds: { x: 10, y: 20, width: 30, height: 40 }
        },
        {
          id: 'selected-1',
          type: 'rectangle',
          visible: true,
          locked: false,
          bounds: { x: 10, y: 20, width: 30, height: 40 }
        }
      ]
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.selectedElements)).toBe(true)
    expect(
      result.selectedElements.every(
        (element) =>
          Object.isFrozen(element) &&
          (element.bounds === null || Object.isFrozen(element.bounds))
      )
    ).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(
      /accessToken|apiKey|must-not-leak/
    )
  })

  it('bounds selected element disclosure while retaining the total count', async () => {
    const selectedIds = Array.from(
      { length: AI_CONTEXT_SELECTED_ELEMENT_LIMIT + 7 },
      (_, index) => `element-${index}`
    )
    const queries = createQueries({
      getSelectedElementIds: vi.fn(() => selectedIds),
      getElementSummary: vi.fn((id) => ({
        id,
        type: 'rectangle',
        visible: true,
        locked: false,
        bounds: null
      }))
    })

    const result = await createAiContextProvider(queries).getContext({
      intent: 'align the selection',
      signal: new AbortController().signal
    })

    expect(result.selectedElementCount).toBe(selectedIds.length)
    expect(result.selectedElements).toHaveLength(
      AI_CONTEXT_SELECTED_ELEMENT_LIMIT
    )
    expect(result.selectedElements.map(({ id }) => id)).toEqual(
      selectedIds.slice(0, AI_CONTEXT_SELECTED_ELEMENT_LIMIT)
    )
  })

  it('rejects pre-abort before reading any app context', async () => {
    const queries = createQueries()
    const controller = new AbortController()
    controller.abort()

    await expect(
      createAiContextProvider(queries).getContext({
        intent: 'create a rectangle',
        signal: controller.signal
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<AiContextCollectionError>>({
        code: 'AI_CONTEXT_ABORTED'
      })
    )
    Object.values(queries).forEach((query) => {
      expect(query).not.toHaveBeenCalled()
    })
  })

  it('rechecks abort after awaited query work before returning context', async () => {
    let release: (() => void) | undefined
    let markStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const gate = new Promise<Record<string, unknown>>((resolve) => {
      release = () =>
        resolve({
          primaryTool: 'select',
          systemMode: 'editing'
        })
    })
    const queries = createQueries({
      getSystemSnapshot: vi.fn(async () => {
        markStarted?.()
        return gate
      })
    })
    const controller = new AbortController()
    const context = createAiContextProvider(queries).getContext({
      intent: 'move the selection',
      signal: controller.signal
    })

    await started
    controller.abort()
    release?.()

    await expect(context).rejects.toEqual(
      expect.objectContaining<Partial<AiContextCollectionError>>({
        code: 'AI_CONTEXT_ABORTED'
      })
    )
  })

  it('rejects empty intent before reading app state', async () => {
    const queries = createQueries()

    await expect(
      createAiContextProvider(queries).getContext({
        intent: '   ',
        signal: new AbortController().signal
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<AiContextCollectionError>>({
        code: 'AI_CONTEXT_INVALID_INTENT'
      })
    )
    Object.values(queries).forEach((query) => {
      expect(query).not.toHaveBeenCalled()
    })
  })
})
