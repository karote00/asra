import { flushSync } from 'react-dom'
import { ContextMenu } from '@asyra/design-system'
import type {
  AppContextMenuSession,
  AppContextMenuSessionDismissReason
} from './context-menu-session'

export interface CanvasContextMenuCommandDescriptor {
  readonly id: string
  readonly label: string
  readonly ariaLabel: string
  readonly shortcutLabel: string
  readonly enabled: boolean
  readonly restoreInvokerFocusOnActivation?: boolean
  readonly execute: () => unknown
}

interface GroupContextMenuProps {
  session: AppContextMenuSession | null
  descriptors: readonly CanvasContextMenuCommandDescriptor[]
  onDismiss: (reason: AppContextMenuSessionDismissReason) => void
}

export const GroupContextMenu = ({
  session,
  descriptors,
  onDismiss
}: GroupContextMenuProps) => {
  if (!session) return null

  return (
    <ContextMenu
      aria-label="Canvas commands"
      items={descriptors.map((descriptor) => ({
        id: descriptor.id,
        label: descriptor.label,
        shortcut: descriptor.shortcutLabel,
        enabled: descriptor.enabled
      }))}
      position={{ x: session.clientX, y: session.clientY }}
      viewport={session.viewport}
      onActivate={(itemId) => {
        const descriptor = descriptors.find(({ id }) => id === itemId)
        if (!descriptor?.enabled) return

        flushSync(() =>
          onDismiss(
            descriptor.restoreInvokerFocusOnActivation === false
              ? 'activation-without-focus-restore'
              : 'activation'
          )
        )
        descriptor.execute()
      }}
      onDismiss={onDismiss}
    />
  )
}
