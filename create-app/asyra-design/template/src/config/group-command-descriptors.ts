import { keyMap } from '@asyra/core'
import { ModifierKey } from '@asyra/utils'
import {
  GroupCommandIds,
  GroupCommandPlatforms,
  type GroupCommand,
  type GroupCommandPlatform
} from '../constants'
import { runGroupCommand } from '../controllers/group-command-actions'
import type { GroupCommandState } from '../controllers/group-commands'

interface GroupCommandDefinition {
  id: GroupCommand
  label: string
  ariaLabel: string
  shifted: boolean
}

export interface GroupCommandShortcut {
  key: string
  modifiers: readonly ModifierKey[]
}

export interface GroupCommandDescriptor {
  id: GroupCommand
  label: string
  ariaLabel: string
  shortcutLabel: string
  shortcut: GroupCommandShortcut
  enabled: boolean
  execute: () => ReturnType<typeof runGroupCommand>
}

interface CreateGroupCommandDescriptorsOptions {
  platform: GroupCommandPlatform
  state: GroupCommandState
  execute?: typeof runGroupCommand
}

const definitions: readonly GroupCommandDefinition[] = [
  {
    id: GroupCommandIds.GROUP,
    label: 'Group',
    ariaLabel: 'Group selected layers',
    shifted: false
  },
  {
    id: GroupCommandIds.UNGROUP,
    label: 'Ungroup',
    ariaLabel: 'Ungroup selected layer',
    shifted: true
  }
]

export const groupShortcutInputRegistrations = [
  {
    platform: GroupCommandPlatforms.MACOS,
    key: keyMap.keys.KeyG,
    modifiers: [ModifierKey.META]
  },
  {
    platform: GroupCommandPlatforms.WINDOWS_LINUX,
    key: keyMap.keys.KeyG,
    modifiers: [ModifierKey.CTRL]
  }
] as const

export const detectGroupCommandPlatform = (
  platformName: string = typeof navigator === 'undefined'
    ? ''
    : navigator.platform
): GroupCommandPlatform =>
  /mac/i.test(platformName)
    ? GroupCommandPlatforms.MACOS
    : GroupCommandPlatforms.WINDOWS_LINUX

const getShortcut = (
  platform: GroupCommandPlatform,
  shifted: boolean
): GroupCommandShortcut => {
  const primaryModifier =
    platform === GroupCommandPlatforms.MACOS
      ? ModifierKey.META
      : ModifierKey.CTRL

  return {
    key: keyMap.keys.KeyG,
    modifiers: shifted
      ? [primaryModifier, ModifierKey.SHIFT]
      : [primaryModifier]
  }
}

const getShortcutLabel = (platform: GroupCommandPlatform, shifted: boolean) => {
  if (platform === GroupCommandPlatforms.MACOS) {
    return shifted ? '⇧⌘G' : '⌘G'
  }
  return shifted ? 'Ctrl+Shift+G' : 'Ctrl+G'
}

export const createGroupCommandDescriptors = ({
  platform,
  state,
  execute = runGroupCommand
}: CreateGroupCommandDescriptorsOptions): readonly GroupCommandDescriptor[] =>
  definitions.map((definition) => {
    const enabled =
      definition.id === GroupCommandIds.GROUP
        ? state.canGroup
        : state.canUngroup

    return {
      id: definition.id,
      label: definition.label,
      ariaLabel: definition.ariaLabel,
      shortcutLabel: getShortcutLabel(platform, definition.shifted),
      shortcut: getShortcut(platform, definition.shifted),
      enabled,
      execute: () => (enabled ? execute(definition.id) : null)
    }
  })
