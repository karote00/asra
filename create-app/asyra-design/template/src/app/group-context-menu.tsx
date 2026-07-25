import { flushSync } from 'react-dom'
import { ContextMenu } from '@asyra/design-system'
import type { GroupCommandDescriptor } from '../config/group-command-descriptors'
import type {
  AppContextMenuSession,
  AppContextMenuSessionDismissReason
} from './context-menu-session'

interface GroupContextMenuProps {
  session: AppContextMenuSession | null
  descriptors: readonly GroupCommandDescriptor[]
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

        flushSync(() => onDismiss('activation'))
        descriptor.execute()
      }}
      onDismiss={onDismiss}
    />
  )
}
