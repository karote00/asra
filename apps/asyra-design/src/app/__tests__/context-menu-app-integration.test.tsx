import { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '..'

const renderAppProps = vi.hoisted(() => vi.fn())
const descriptorMocks = vi.hoisted(() => ({
  executeGroup: vi.fn(),
  executeUngroup: vi.fn()
}))

vi.mock('../../render-app', () => ({
  default: (props: unknown) => {
    renderAppProps(props)
    return <div data-testid="render-app" />
  }
}))
vi.mock('../../toolbar', () => ({ default: () => null }))
vi.mock('../../contents', () => ({ default: () => null }))
vi.mock('../../properties', () => ({ default: () => null }))
vi.mock('../../animation', () => ({ default: () => null }))
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
  createGroupCommandDescriptors: () => [
    {
      id: 'group',
      label: 'Group',
      ariaLabel: 'Group selected layers',
      shortcutLabel: '⌘G',
      shortcut: { key: 'G', modifiers: ['meta'] },
      enabled: true,
      execute: descriptorMocks.executeGroup
    },
    {
      id: 'ungroup',
      label: 'Ungroup',
      ariaLabel: 'Ungroup selected layer',
      shortcutLabel: '⇧⌘G',
      shortcut: { key: 'G', modifiers: ['meta', 'shift'] },
      enabled: false,
      execute: descriptorMocks.executeUngroup
    }
  ]
}))

describe('App context-menu composition', () => {
  beforeEach(() => {
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
    render(<App />)

    expect(renderAppProps).toHaveBeenCalled()
    expect(renderAppProps.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        onContextMenuRequest: expect.any(Function)
      })
    )
  })

  it('presents fixed rows and closes before one enabled descriptor execution', async () => {
    render(<App />)
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
      'Group⌘G',
      'Ungroup⇧⌘G'
    ])
    expect(rows[1]?.getAttribute('aria-disabled')).toBe('true')

    fireEvent.click(rows[1] as HTMLElement)
    expect(descriptorMocks.executeUngroup).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeTruthy()

    descriptorMocks.executeGroup.mockImplementation(() => {
      expect(screen.queryByRole('menu')).toBeNull()
      return null
    })
    fireEvent.click(rows[0] as HTMLElement)

    expect(descriptorMocks.executeGroup).toHaveBeenCalledTimes(1)
    await act(async () => Promise.resolve())
    expect(document.activeElement).toBe(canvasHost)
  })
})
