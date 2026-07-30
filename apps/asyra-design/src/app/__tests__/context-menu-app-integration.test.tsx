import { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '..'

const renderAppProps = vi.hoisted(() => vi.fn())
const toolbarProps = vi.hoisted(() => vi.fn())
const descriptorMocks = vi.hoisted(() => ({
  executeGroup: vi.fn(),
  executeUngroup: vi.fn()
}))
const aiMocks = vi.hoisted(() => ({
  activeTurn: null as { intent: string } | null,
  cancel: vi.fn()
}))

vi.mock('../../render-app', () => ({
  default: (props: unknown) => {
    renderAppProps(props)
    return <div data-testid="render-app" tabIndex={-1} />
  }
}))
vi.mock('../../toolbar', () => ({
  default: (props: {
    aiOpen: boolean
    onAiToggle: (invoker: HTMLButtonElement) => void
  }) => {
    toolbarProps(props)
    return props.onAiToggle ? (
      <button
        aria-label="Mock toolbar AI"
        onClick={(event) => props.onAiToggle(event.currentTarget)}
        type="button"
      />
    ) : null
  }
}))
vi.mock('../../contents', () => ({ default: () => null }))
vi.mock('../../properties', () => ({ default: () => null }))
vi.mock('../../animation', () => ({ default: () => null }))
vi.mock('../ai-conversation-panel', () => ({
  AiConversationPanel: ({ onClose }: { onClose: () => void }) => (
    <aside aria-label="Mock AI conversation">
      <textarea
        aria-label="Message Mock AI"
        autoFocus
        data-ai-agent-prompt="true"
      />
      <button onClick={onClose} type="button">
        Close Mock AI
      </button>
    </aside>
  )
}))
vi.mock('../ai-history-message-bar', () => ({
  AiHistoryMessageBar: () => null
}))
vi.mock('../../providers', () => ({
  useElementSelection: () => new Set(['a', 'b']),
  useFlattenedIdsData: () => ['a', 'b'],
  useElementDataMap: () => ({
    a: { id: 'a', type: 'element', parentId: 'workspace' },
    b: { id: 'b', type: 'element', parentId: 'workspace' }
  })
}))
vi.mock('../../config/group-command-descriptors', () => ({
  detectGroupCommandPlatform: () => 'macos',
  createGroupCommandDescriptors: ({ platform }: { platform: string }) => {
    const macOS = platform === 'macos'
    return [
      {
        id: 'group',
        label: 'Group',
        ariaLabel: 'Group selected layers',
        shortcutLabel: macOS ? '⌘G' : 'Ctrl+G',
        shortcut: {
          key: 'G',
          modifiers: [macOS ? 'meta' : 'ctrl']
        },
        enabled: true,
        execute: descriptorMocks.executeGroup
      },
      {
        id: 'ungroup',
        label: 'Ungroup',
        ariaLabel: 'Ungroup selected layer',
        shortcutLabel: macOS ? '⇧⌘G' : 'Ctrl+Shift+G',
        shortcut: {
          key: 'G',
          modifiers: [macOS ? 'meta' : 'ctrl', 'shift']
        },
        enabled: false,
        execute: descriptorMocks.executeUngroup
      }
    ]
  }
}))

const createAi = () =>
  ({
    confirmation: {},
    conversation: {
      cancel: aiMocks.cancel,
      getSnapshot: () => ({ activeTurn: aiMocks.activeTurn })
    },
    history: {}
  }) as never

describe('App context-menu composition', () => {
  beforeEach(() => {
    aiMocks.activeTurn = null
    ;(
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean
      }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    ;(
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean
      }
    ).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('routes accepted Render canvas invocations into the app-local session', () => {
    render(<App ai={createAi()} />)

    expect(renderAppProps).toHaveBeenCalled()
    const props = renderAppProps.mock.lastCall?.[0] as {
      onContextMenuRequest: (invocation: {
        clientX: number
        clientY: number
        invoker: HTMLDivElement
      }) => void
      onCanvasHostTeardown: () => void
    }
    expect(props).toEqual(
      expect.objectContaining({
        onContextMenuRequest: expect.any(Function),
        onCanvasHostTeardown: expect.any(Function)
      })
    )

    const canvasHost = document.createElement('div')
    document.body.append(canvasHost)
    act(() => {
      props.onContextMenuRequest({
        clientX: 100,
        clientY: 120,
        invoker: canvasHost
      })
    })
    expect(screen.getByRole('menu')).toBeTruthy()

    act(() => props.onCanvasHostTeardown())
    expect(screen.queryByRole('menu')).toBeNull()
    expect(descriptorMocks.executeGroup).not.toHaveBeenCalled()
    expect(descriptorMocks.executeUngroup).not.toHaveBeenCalled()
  })

  it('presents fixed rows and closes before one enabled descriptor execution', async () => {
    render(<App ai={createAi()} />)
    const canvasHost = document.createElement('div')
    canvasHost.tabIndex = -1
    document.body.append(canvasHost)
    const props = renderAppProps.mock.lastCall?.[0] as {
      onContextMenuRequest?: (invocation: {
        clientX: number
        clientY: number
        invoker: HTMLDivElement
      }) => void
    }

    act(() => {
      props.onContextMenuRequest?.({
        clientX: 312,
        clientY: 184,
        invoker: canvasHost
      })
    })

    const rows = screen.getAllByRole('menuitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      'Toggle Agent Panel⌘I',
      'Group⌘G',
      'Ungroup⇧⌘G'
    ])
    expect(rows[2]?.getAttribute('aria-disabled')).toBe('true')

    fireEvent.click(rows[2] as HTMLElement)
    expect(descriptorMocks.executeUngroup).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeTruthy()

    descriptorMocks.executeGroup.mockImplementation(() => {
      expect(screen.queryByRole('menu')).toBeNull()
      return null
    })
    fireEvent.click(rows[1] as HTMLElement)

    expect(descriptorMocks.executeGroup).toHaveBeenCalledTimes(1)
    await act(async () => Promise.resolve())
    expect(document.activeElement).toBe(canvasHost)
  })

  it('isolates open state, position, focus, platform labels, and teardown across app roots', async () => {
    const firstRoot = render(
      <App ai={createAi()} groupCommandPlatform="macos" />
    )
    const firstRequest = (
      renderAppProps.mock.lastCall?.[0] as {
        onContextMenuRequest: (invocation: {
          clientX: number
          clientY: number
          invoker: HTMLDivElement
        }) => void
      }
    ).onContextMenuRequest
    const secondRoot = render(
      <App ai={createAi()} groupCommandPlatform="windows-linux" />
    )
    const secondRequest = (
      renderAppProps.mock.lastCall?.[0] as {
        onContextMenuRequest: (invocation: {
          clientX: number
          clientY: number
          invoker: HTMLDivElement
        }) => void
      }
    ).onContextMenuRequest
    const firstCanvas = document.createElement('div')
    const secondCanvas = document.createElement('div')
    firstCanvas.tabIndex = -1
    secondCanvas.tabIndex = -1
    document.body.append(firstCanvas, secondCanvas)

    act(() => {
      firstRequest({
        clientX: 45,
        clientY: 60,
        invoker: firstCanvas
      })
      secondRequest({
        clientX: 420,
        clientY: 260,
        invoker: secondCanvas
      })
    })

    let menus = screen.getAllByRole('menu')
    expect(menus).toHaveLength(2)
    expect(menus.map((menu) => [menu.style.left, menu.style.top])).toEqual([
      ['45px', '60px'],
      ['420px', '260px']
    ])
    expect(
      screen.getAllByRole('menuitem').map((row) => row.textContent)
    ).toEqual([
      'Toggle Agent Panel⌘I',
      'Group⌘G',
      'Ungroup⇧⌘G',
      'Toggle Agent PanelCtrl+I',
      'GroupCtrl+G',
      'UngroupCtrl+Shift+G'
    ])

    fireEvent.keyDown(menus[0] as HTMLElement, { key: 'Escape' })
    await act(async () => Promise.resolve())
    menus = screen.getAllByRole('menu')
    expect(menus).toHaveLength(1)
    expect(screen.getAllByRole('menuitem')[0]?.textContent).toBe(
      'Toggle Agent PanelCtrl+I'
    )
    expect(document.activeElement).toBe(firstCanvas)

    act(() => {
      firstRequest({
        clientX: 80,
        clientY: 90,
        invoker: firstCanvas
      })
    })
    expect(screen.getAllByRole('menu')).toHaveLength(2)

    firstRoot.unmount()
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(screen.getAllByRole('menuitem')[0]?.textContent).toBe(
      'Toggle Agent PanelCtrl+I'
    )

    secondRoot.unmount()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('shares one Agent panel toggle across toolbar, shortcut, and Context Menu', async () => {
    render(<App ai={createAi()} groupCommandPlatform="macos" />)
    const canvasHost = screen.getByTestId('render-app')
    const props = renderAppProps.mock.lastCall?.[0] as {
      onContextMenuRequest: (invocation: {
        clientX: number
        clientY: number
        invoker: HTMLDivElement
      }) => void
    }

    act(() => {
      props.onContextMenuRequest({
        clientX: 240,
        clientY: 180,
        invoker: canvasHost as HTMLDivElement
      })
    })
    const rows = screen.getAllByRole('menuitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      'Toggle Agent Panel⌘I',
      'Group⌘G',
      'Ungroup⇧⌘G'
    ])

    fireEvent.click(rows[0] as HTMLElement)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByLabelText('Mock AI conversation')).toBeTruthy()
    expect(document.activeElement).toBe(
      screen.getByLabelText('Message Mock AI')
    )

    fireEvent.keyDown(screen.getByLabelText('Message Mock AI'), {
      key: 'i',
      metaKey: true
    })
    expect(screen.queryByLabelText('Mock AI conversation')).toBeNull()
    await act(async () => Promise.resolve())
    expect(document.activeElement).toBe(canvasHost)

    fireEvent.click(screen.getByRole('button', { name: 'Mock toolbar AI' }))
    expect(screen.getByLabelText('Mock AI conversation')).toBeTruthy()
  })

  it('keeps the shortcut app-root-local and bypasses unrelated editable fields', () => {
    render(<App ai={createAi()} groupCommandPlatform="macos" />)
    const outsideInput = document.createElement('input')
    document.body.append(outsideInput)

    fireEvent.keyDown(outsideInput, { key: 'i', metaKey: true })
    expect(screen.queryByLabelText('Mock AI conversation')).toBeNull()

    fireEvent.keyDown(screen.getByTestId('render-app'), {
      key: 'i',
      metaKey: true
    })
    expect(screen.getByLabelText('Mock AI conversation')).toBeTruthy()
  })

  it('cancels an active turn when an external toggle closes the panel', () => {
    aiMocks.activeTurn = { intent: '畫一個貓臉' }
    render(<App ai={createAi()} groupCommandPlatform="macos" />)
    const toolbarButton = screen.getByRole('button', {
      name: 'Mock toolbar AI'
    })

    fireEvent.click(toolbarButton)
    fireEvent.click(toolbarButton)

    expect(aiMocks.cancel).toHaveBeenCalledOnce()
    expect(aiMocks.cancel).toHaveBeenCalledWith('panel-closed')
  })
})
