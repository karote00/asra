import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'

const items: ContextMenuItem[] = [
  {
    id: 'group',
    label: 'Group',
    shortcut: '⌘G',
    enabled: true
  },
  {
    id: 'ungroup',
    label: 'Ungroup',
    enabled: false
  }
]

const viewport = {
  left: 0,
  top: 0,
  width: 800,
  height: 600
}

describe('ContextMenu', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders ordered accessible rows with left labels and supplied right shortcuts', () => {
    const onActivate = vi.fn()

    render(
      <ContextMenu
        aria-label="Canvas commands"
        items={items}
        position={{ x: 120, y: 80 }}
        viewport={viewport}
        onActivate={onActivate}
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByRole('menu', { name: 'Canvas commands' })).toBeTruthy()
    const rows = screen.getAllByRole('menuitem')
    expect(rows.map((row) => row.textContent)).toEqual(['Group⌘G', 'Ungroup'])
    expect(rows[0]?.getAttribute('aria-disabled')).toBe('false')
    expect(rows[1]?.getAttribute('aria-disabled')).toBe('true')
    expect(
      rows[0]?.querySelector('[data-context-menu-label]')?.textContent
    ).toBe('Group')
    expect(
      rows[0]?.querySelector('[data-context-menu-shortcut]')?.textContent
    ).toBe('⌘G')
    expect(
      rows[1]?.querySelector('[data-context-menu-shortcut]')?.textContent
    ).toBe('')

    fireEvent.click(rows[1] as HTMLElement)
    expect(onActivate).not.toHaveBeenCalled()

    fireEvent.click(rows[0] as HTMLElement)
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledWith('group')
  })

  it('focuses and navigates enabled rows while emitting one keyboard activation', () => {
    const onActivate = vi.fn()
    const navigationItems: ContextMenuItem[] = [
      ...items,
      {
        id: 'third',
        label: 'Third',
        shortcut: 'T',
        enabled: true
      }
    ]

    render(
      <ContextMenu
        aria-label="Canvas commands"
        items={navigationItems}
        position={{ x: 120, y: 80 }}
        viewport={viewport}
        onActivate={onActivate}
        onDismiss={vi.fn()}
      />
    )

    const menu = screen.getByRole('menu')
    const rows = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(rows[0])

    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(rows[2])

    fireEvent.keyDown(menu, { key: 'Home' })
    expect(document.activeElement).toBe(rows[0])

    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(rows[2])

    fireEvent.keyDown(menu, { key: 'Home' })
    fireEvent.keyDown(menu, { key: 'End' })
    expect(document.activeElement).toBe(rows[2])

    fireEvent.keyDown(menu, { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenLastCalledWith('third')

    fireEvent.keyDown(menu, { key: ' ' })
    expect(onActivate).toHaveBeenCalledTimes(2)
    expect(onActivate).toHaveBeenLastCalledWith('third')
  })

  it('emits dismissal intents for Escape, Tab, and outside primary pointer press', () => {
    const onDismiss = vi.fn()

    render(
      <ContextMenu
        aria-label="Canvas commands"
        items={items}
        position={{ x: 120, y: 80 }}
        viewport={viewport}
        onActivate={vi.fn()}
        onDismiss={onDismiss}
      />
    )

    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'Escape' })
    fireEvent.keyDown(menu, { key: 'Tab' })
    fireEvent(
      document.body,
      new MouseEvent('pointerdown', { bubbles: true, button: 0 })
    )
    fireEvent(
      document.body,
      new MouseEvent('pointerdown', { bubbles: true, button: 2 })
    )

    expect(onDismiss.mock.calls).toEqual([
      ['escape'],
      ['tab'],
      ['outside-pointer']
    ])
  })

  it('removes its portal and owned outside listener on unmount', () => {
    const onDismiss = vi.fn()
    const { unmount } = render(
      <ContextMenu
        aria-label="Canvas commands"
        items={items}
        position={{ x: 120, y: 80 }}
        viewport={viewport}
        onActivate={vi.fn()}
        onDismiss={onDismiss}
      />
    )

    expect(screen.getByRole('menu')).toBeTruthy()
    unmount()
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent(
      document.body,
      new MouseEvent('pointerdown', { bubbles: true, button: 0 })
    )
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('clamps the measured menu inside the supplied viewport', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 180,
      bottom: 80,
      width: 180,
      height: 80,
      toJSON: () => ({})
    })

    render(
      <ContextMenu
        aria-label="Canvas commands"
        items={items}
        position={{ x: 290, y: 190 }}
        viewport={{ left: 10, top: 20, width: 300, height: 200 }}
        onActivate={vi.fn()}
        onDismiss={vi.fn()}
      />
    )

    const menu = screen.getByRole('menu')
    expect(menu.style.left).toBe('130px')
    expect(menu.style.top).toBe('140px')
  })

  it('focuses the menu itself when every row is disabled', () => {
    render(
      <ContextMenu
        aria-label="Canvas commands"
        items={items.map((item) => ({ ...item, enabled: false }))}
        position={{ x: 120, y: 80 }}
        viewport={viewport}
        onActivate={vi.fn()}
        onDismiss={vi.fn()}
      />
    )

    const menu = screen.getByRole('menu')
    expect(menu.tabIndex).toBe(0)
    expect(document.activeElement).toBe(menu)
  })
})
