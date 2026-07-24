import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  id: string
  label: string
  shortcut?: string
  enabled: boolean
}

export interface ContextMenuPosition {
  x: number
  y: number
}

export interface ContextMenuViewport {
  left: number
  top: number
  width: number
  height: number
}

export type ContextMenuDismissReason = 'escape' | 'outside-pointer' | 'tab'

export interface ContextMenuProps {
  'aria-label': string
  items: readonly ContextMenuItem[]
  position: ContextMenuPosition
  viewport: ContextMenuViewport
  onActivate: (itemId: string) => void
  onDismiss: (reason: ContextMenuDismissReason) => void
  portalContainer?: HTMLElement
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum))

export const ContextMenu = ({
  'aria-label': ariaLabel,
  items,
  position,
  viewport,
  onActivate,
  onDismiss,
  portalContainer
}: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [placement, setPlacement] = useState(position)
  const enabledIndices = items.flatMap((item, index) =>
    item.enabled ? [index] : []
  )
  const itemMeasurementKey = items
    .map(
      (item) =>
        `${item.id}\u0000${item.label}\u0000${item.shortcut ?? ''}\u0000${item.enabled}`
    )
    .join('\u0001')
  const enabledItemKey = items
    .map((item) => `${item.id}\u0000${item.enabled}`)
    .join('\u0001')

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return

    const bounds = menu.getBoundingClientRect()
    const nextPlacement = {
      x: clamp(
        position.x,
        viewport.left,
        viewport.left + viewport.width - bounds.width
      ),
      y: clamp(
        position.y,
        viewport.top,
        viewport.top + viewport.height - bounds.height
      )
    }

    setPlacement((current) =>
      current.x === nextPlacement.x && current.y === nextPlacement.y
        ? current
        : nextPlacement
    )
  }, [
    itemMeasurementKey,
    position.x,
    position.y,
    viewport.height,
    viewport.left,
    viewport.top,
    viewport.width
  ])

  useLayoutEffect(() => {
    const firstEnabledIndex = enabledIndices[0]
    if (firstEnabledIndex === undefined) {
      menuRef.current?.focus()
      return
    }

    itemRefs.current[firstEnabledIndex]?.focus()
  }, [enabledItemKey])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.button === 0 &&
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        onDismiss('outside-pointer')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () =>
      document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [onDismiss])

  const focusItem = (index: number) => {
    itemRefs.current[index]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onDismiss('escape')
      return
    }

    if (event.key === 'Tab') {
      onDismiss('tab')
      return
    }

    if (enabledIndices.length === 0) return

    const activeIndex = itemRefs.current.findIndex(
      (item) => item === document.activeElement
    )
    const enabledPosition = enabledIndices.indexOf(activeIndex)

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      let startPosition = enabledPosition
      if (enabledPosition === -1) {
        startPosition = direction === 1 ? -1 : 0
      }
      const nextPosition =
        (startPosition + direction + enabledIndices.length) %
        enabledIndices.length
      focusItem(enabledIndices[nextPosition] as number)
      return
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const targetIndex =
        event.key === 'Home'
          ? enabledIndices[0]
          : enabledIndices[enabledIndices.length - 1]
      focusItem(targetIndex as number)
      return
    }

    if (
      (event.key === 'Enter' || event.key === ' ') &&
      enabledIndices.includes(activeIndex)
    ) {
      event.preventDefault()
      const item = items[activeIndex]
      if (item) onActivate(item.id)
    }
  }

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      tabIndex={enabledIndices.length === 0 ? 0 : -1}
      className="fixed z-50 min-w-[220px] rounded-lg border border-border-hover bg-panel-surface p-1 font-sans text-text-primary shadow-popup outline-none"
      style={{ left: placement.x, top: placement.y }}
      onKeyDown={handleKeyDown}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(element) => {
            itemRefs.current[index] = element
          }}
          type="button"
          role="menuitem"
          aria-disabled={!item.enabled}
          disabled={!item.enabled}
          className={`flex w-full items-center justify-between gap-8 rounded-md px-2.5 py-1.5 text-left text-[12px] leading-5 outline-none transition-colors ${
            item.enabled
              ? 'cursor-default text-text-primary hover:bg-panel-surface-hover focus:bg-panel-surface-hover active:bg-panel-deep'
              : 'cursor-default text-text-disabled'
          }`}
          onClick={() => {
            if (item.enabled) onActivate(item.id)
          }}
        >
          <span data-context-menu-label>{item.label}</span>
          <span
            data-context-menu-shortcut
            aria-hidden="true"
            className="min-w-0 text-right text-[11px] text-text-tertiary"
          >
            {item.shortcut ?? ''}
          </span>
        </button>
      ))}
    </div>
  )

  return createPortal(menu, portalContainer ?? document.body)
}
