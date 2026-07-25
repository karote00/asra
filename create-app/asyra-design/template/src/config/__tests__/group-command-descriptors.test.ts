import { beforeEach, describe, expect, it, vi } from 'vitest'
import { keyMap } from '@asyra/core'
import { ModifierKey } from '@asyra/utils'
import { GroupCommandIds, GroupCommandPlatforms } from '../../constants'
import { runGroupCommand } from '../../controllers/group-command-actions'
import {
  createGroupCommandDescriptors,
  detectGroupCommandPlatform,
  groupShortcutInputRegistrations
} from '../group-command-descriptors'

vi.mock('../../controllers/group-command-actions', () => ({
  runGroupCommand: vi.fn()
}))

const state = {
  canGroup: true,
  canUngroup: false,
  canonicalSelectedIds: ['a', 'b']
}

describe('Group command descriptors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('projects fixed-order macOS rows from one command metadata source', () => {
    const descriptors = createGroupCommandDescriptors({
      platform: GroupCommandPlatforms.MACOS,
      state
    })

    expect(descriptors).toEqual([
      expect.objectContaining({
        id: GroupCommandIds.GROUP,
        label: 'Group',
        shortcutLabel: '⌘G',
        shortcut: {
          key: keyMap.keys.KeyG,
          modifiers: [ModifierKey.META]
        },
        enabled: true,
        execute: expect.any(Function)
      }),
      expect.objectContaining({
        id: GroupCommandIds.UNGROUP,
        label: 'Ungroup',
        shortcutLabel: '⇧⌘G',
        shortcut: {
          key: keyMap.keys.KeyG,
          modifiers: [ModifierKey.META, ModifierKey.SHIFT]
        },
        enabled: false,
        execute: expect.any(Function)
      })
    ])
  })

  it('projects Windows/Linux labels and Ctrl bindings deterministically', () => {
    const descriptors = createGroupCommandDescriptors({
      platform: GroupCommandPlatforms.WINDOWS_LINUX,
      state: {
        ...state,
        canGroup: false,
        canUngroup: true
      }
    })

    expect(
      descriptors.map(({ id, shortcutLabel, shortcut, enabled }) => ({
        id,
        shortcutLabel,
        shortcut,
        enabled
      }))
    ).toEqual([
      {
        id: GroupCommandIds.GROUP,
        shortcutLabel: 'Ctrl+G',
        shortcut: {
          key: keyMap.keys.KeyG,
          modifiers: [ModifierKey.CTRL]
        },
        enabled: false
      },
      {
        id: GroupCommandIds.UNGROUP,
        shortcutLabel: 'Ctrl+Shift+G',
        shortcut: {
          key: keyMap.keys.KeyG,
          modifiers: [ModifierKey.CTRL, ModifierKey.SHIFT]
        },
        enabled: true
      }
    ])
  })

  it('routes enabled descriptors once and bypasses disabled descriptors', () => {
    vi.mocked(runGroupCommand).mockReturnValue({
      command: GroupCommandIds.GROUP,
      groupId: 'group-created',
      selectedIds: ['group-created']
    })
    const [group, ungroup] = createGroupCommandDescriptors({
      platform: GroupCommandPlatforms.MACOS,
      state
    })

    expect(group?.execute()).toMatchObject({
      command: GroupCommandIds.GROUP
    })
    expect(ungroup?.execute()).toBeNull()
    expect(runGroupCommand).toHaveBeenCalledTimes(1)
    expect(runGroupCommand).toHaveBeenCalledWith(GroupCommandIds.GROUP)
  })

  it('derives platform input and Input System registrations without duplicate Shift combos', () => {
    expect(detectGroupCommandPlatform('MacIntel')).toBe(
      GroupCommandPlatforms.MACOS
    )
    expect(detectGroupCommandPlatform('Win32')).toBe(
      GroupCommandPlatforms.WINDOWS_LINUX
    )
    expect(detectGroupCommandPlatform('Linux x86_64')).toBe(
      GroupCommandPlatforms.WINDOWS_LINUX
    )
    expect(groupShortcutInputRegistrations).toEqual([
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
    ])

    groupShortcutInputRegistrations.forEach((registration) => {
      const [group, ungroup] = createGroupCommandDescriptors({
        platform: registration.platform,
        state
      })
      expect(group?.shortcut).toEqual({
        key: registration.key,
        modifiers: registration.modifiers
      })
      expect(ungroup?.shortcut).toEqual({
        key: registration.key,
        modifiers: [...registration.modifiers, ModifierKey.SHIFT]
      })
    })
  })
})
