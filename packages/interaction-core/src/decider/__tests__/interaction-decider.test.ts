import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InputSystemEvents, PrimaryToolType } from '@asyra/utils'
import { decideInteraction } from '../interaction-decider'
import * as behavior from '../behavior'
import { baseSnapshot } from '../rules/__tests__/test-helpers'

vi.mock('../behavior', () => ({
  decideDragStartBehavior: vi.fn(),
  decideDragUpdateBehavior: vi.fn(),
  decideDragEndBehavior: vi.fn(),
  decidePanZoomBehavior: vi.fn(),
  decideSwitchPrimaryToolBehavior: vi.fn(),
  decideUndoRedoBehavior: vi.fn(),
  decideZoomFitBehavior: vi.fn()
}))

describe('decideInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call decideDragStartBehavior for INPUT_DRAG_START event', () => {
    decideInteraction(InputSystemEvents.INPUT_DRAG_START, baseSnapshot)

    expect(behavior.decideDragStartBehavior).toHaveBeenCalledWith(baseSnapshot)
    expect(behavior.decideDragUpdateBehavior).not.toHaveBeenCalled()
    expect(behavior.decideDragEndBehavior).not.toHaveBeenCalled()
    expect(behavior.decidePanZoomBehavior).not.toHaveBeenCalled()
    expect(behavior.decideSwitchPrimaryToolBehavior).not.toHaveBeenCalled()
    expect(behavior.decideUndoRedoBehavior).not.toHaveBeenCalled()
    expect(behavior.decideZoomFitBehavior).not.toHaveBeenCalled()
  })

  it('should call decideDragUpdateBehavior for INPUT_DRAG_UPDATE event', () => {
    decideInteraction(InputSystemEvents.INPUT_DRAG_UPDATE, baseSnapshot)

    expect(behavior.decideDragUpdateBehavior).toHaveBeenCalledWith(baseSnapshot)
    expect(behavior.decideDragStartBehavior).not.toHaveBeenCalled()
  })

  it('should call decideDragEndBehavior for INPUT_DRAG_END event', () => {
    decideInteraction(InputSystemEvents.INPUT_DRAG_END, baseSnapshot)

    expect(behavior.decideDragEndBehavior).toHaveBeenCalledWith(baseSnapshot)
  })

  it('should call decideSwitchPrimaryToolBehavior for INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL event', () => {
    const detail = { primaryTool: PrimaryToolType.RECTANGLE }

    decideInteraction(
      InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
      baseSnapshot,
      detail
    )

    expect(behavior.decideSwitchPrimaryToolBehavior).toHaveBeenCalledWith(
      detail
    )
  })

  it('should call decideUndoRedoBehavior for INPUT_SHORTCUT_UNDOREDO event', () => {
    decideInteraction(InputSystemEvents.INPUT_SHORTCUT_UNDOREDO, baseSnapshot)

    expect(behavior.decideUndoRedoBehavior).toHaveBeenCalledWith(baseSnapshot)
  })

  it('should call decideZoomFitBehavior for INPUT_SHORTCUT_ZOOM_PRESET event', () => {
    decideInteraction(
      InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET,
      baseSnapshot
    )

    expect(behavior.decideZoomFitBehavior).toHaveBeenCalled()
  })

  it('should call decidePanZoomBehavior for INPUT_WHEEL_SCROLL event', () => {
    decideInteraction(InputSystemEvents.INPUT_WHEEL_SCROLL, baseSnapshot)

    expect(behavior.decidePanZoomBehavior).toHaveBeenCalledWith(baseSnapshot)
  })

  it('should return null for unhandled events', () => {
    const unhandledEvent = 'UNHANDLED_EVENT' as InputSystemEvents

    const result = decideInteraction(unhandledEvent, baseSnapshot)

    expect(result).toBeNull()
  })
})
