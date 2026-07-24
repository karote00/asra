import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runGroupCommand } from '../controllers/group-command-actions'
import { GroupCommandControls } from './GroupCommandControls'

vi.mock('../controllers/group-command-actions', () => ({
  runGroupCommand: vi.fn()
}))

describe('Layers Group command controls', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('exposes stable accessible controls and disabled availability', () => {
    render(<GroupCommandControls canGroup={false} canUngroup={false} />)

    const groupButton = screen.getByTestId(
      'layers-group-button'
    ) as HTMLButtonElement
    const ungroupButton = screen.getByTestId(
      'layers-ungroup-button'
    ) as HTMLButtonElement

    expect(groupButton.getAttribute('aria-label')).toBe('Group selected layers')
    expect(ungroupButton.getAttribute('aria-label')).toBe(
      'Ungroup selected layer'
    )
    expect(groupButton.disabled).toBe(true)
    expect(ungroupButton.disabled).toBe(true)
  })

  it('routes enabled controls through the same Group feature API controller', () => {
    render(<GroupCommandControls canGroup canUngroup />)

    fireEvent.click(screen.getByTestId('layers-group-button'))
    fireEvent.click(screen.getByTestId('layers-ungroup-button'))

    expect(runGroupCommand).toHaveBeenNthCalledWith(1, 'group')
    expect(runGroupCommand).toHaveBeenNthCalledWith(2, 'ungroup')
  })
})
