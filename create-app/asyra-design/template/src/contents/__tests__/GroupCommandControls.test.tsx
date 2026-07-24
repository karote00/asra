import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModifierKey } from '@asyra/utils'
import { GroupCommandIds } from '../../constants'
import type { GroupCommandDescriptor } from '../../config/group-command-descriptors'
import { GroupCommandControls } from '../GroupCommandControls'

const createDescriptors = (
  canGroup: boolean,
  canUngroup: boolean,
  executeGroup = vi.fn(),
  executeUngroup = vi.fn()
): readonly GroupCommandDescriptor[] => [
  {
    id: GroupCommandIds.GROUP,
    label: 'Group',
    ariaLabel: 'Group selected layers',
    shortcutLabel: '⌘G',
    shortcut: { key: 'g', modifiers: [ModifierKey.META] },
    enabled: canGroup,
    execute: executeGroup
  },
  {
    id: GroupCommandIds.UNGROUP,
    label: 'Ungroup',
    ariaLabel: 'Ungroup selected layer',
    shortcutLabel: '⇧⌘G',
    shortcut: {
      key: 'g',
      modifiers: [ModifierKey.META, ModifierKey.SHIFT]
    },
    enabled: canUngroup,
    execute: executeUngroup
  }
]

describe('Layers Group command controls', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('exposes stable accessible controls and disabled availability', () => {
    render(
      <GroupCommandControls descriptors={createDescriptors(false, false)} />
    )

    const groupButton = screen.getByTestId(
      'layers-group-button'
    ) as HTMLButtonElement
    const ungroupButton = screen.getByTestId(
      'layers-ungroup-button'
    ) as HTMLButtonElement

    expect(groupButton.getAttribute('aria-label')).toBe('Group selected layers')
    expect(groupButton.dataset.layerPointerBypass).toBe('true')
    expect(ungroupButton.getAttribute('aria-label')).toBe(
      'Ungroup selected layer'
    )
    expect(ungroupButton.dataset.layerPointerBypass).toBe('true')
    expect(groupButton.disabled).toBe(true)
    expect(ungroupButton.disabled).toBe(true)
    expect(groupButton.title).toBe('Group (⌘G)')
    expect(ungroupButton.title).toBe('Ungroup (⇧⌘G)')
  })

  it('routes enabled controls through the supplied shared descriptors', () => {
    const executeGroup = vi.fn()
    const executeUngroup = vi.fn()
    render(
      <GroupCommandControls
        descriptors={createDescriptors(
          true,
          true,
          executeGroup,
          executeUngroup
        )}
      />
    )

    fireEvent.click(screen.getByTestId('layers-group-button'))
    fireEvent.click(screen.getByTestId('layers-ungroup-button'))

    expect(executeGroup).toHaveBeenCalledTimes(1)
    expect(executeUngroup).toHaveBeenCalledTimes(1)
  })
})
