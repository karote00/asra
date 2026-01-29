import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InputSystemEvents, PrimaryToolType } from '@asyra/utils'
import { initInteractions } from '../interaction-decider'
import { InteractionRegistry } from '../../registry'
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

describe('initInteractions', () => {
  let registry: InteractionRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    registry = new InteractionRegistry()
    initInteractions(registry)
  })

  it('should register decideDragStartBehavior for INPUT_DRAG_START event', () => {
    registry.decide(InputSystemEvents.INPUT_DRAG_START, baseSnapshot)

    expect(behavior.decideDragStartBehavior).toHaveBeenCalledWith(baseSnapshot)
    expect(behavior.decideDragUpdateBehavior).not.toHaveBeenCalled()
    expect(behavior.decideDragEndBehavior).not.toHaveBeenCalled()
    expect(behavior.decidePanZoomBehavior).not.toHaveBeenCalled()
    expect(behavior.decideSwitchPrimaryToolBehavior).not.toHaveBeenCalled()
    expect(behavior.decideUndoRedoBehavior).not.toHaveBeenCalled()
    expect(behavior.decideZoomFitBehavior).not.toHaveBeenCalled()
  })

  it('should register decideDragUpdateBehavior for INPUT_DRAG_UPDATE event', () => {
    registry.decide(InputSystemEvents.INPUT_DRAG_UPDATE, baseSnapshot)

    expect(behavior.decideDragUpdateBehavior).toHaveBeenCalledWith(baseSnapshot)
    expect(behavior.decideDragStartBehavior).not.toHaveBeenCalled()
  })

  it('should register decideDragEndBehavior for INPUT_DRAG_END event', () => {
    registry.decide(InputSystemEvents.INPUT_DRAG_END, baseSnapshot)

    expect(behavior.decideDragEndBehavior).toHaveBeenCalledWith(baseSnapshot)
  })

  it('should register decideSwitchPrimaryToolBehavior for INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL event', () => {
    const detail = { primaryTool: PrimaryToolType.RECTANGLE }

    registry.decide(
      InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
      baseSnapshot,
      detail
    )

    expect(behavior.decideSwitchPrimaryToolBehavior).toHaveBeenCalledWith(
      detail
    )
  })

  it('should register decideUndoRedoBehavior for INPUT_SHORTCUT_UNDOREDO event', () => {
    registry.decide(InputSystemEvents.INPUT_SHORTCUT_UNDOREDO, baseSnapshot)

    expect(behavior.decideUndoRedoBehavior).toHaveBeenCalledWith(baseSnapshot)
  })

  it('should register decideZoomFitBehavior for INPUT_SHORTCUT_ZOOM_PRESET event', () => {
    registry.decide(
      InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET,
      baseSnapshot
    )

    expect(behavior.decideZoomFitBehavior).toHaveBeenCalled()
  })

  it('should register decidePanZoomBehavior for INPUT_WHEEL_SCROLL event', () => {
    registry.decide(InputSystemEvents.INPUT_WHEEL_SCROLL, baseSnapshot)

    expect(behavior.decidePanZoomBehavior).toHaveBeenCalledWith(baseSnapshot)
  })

  it('should return null for unhandled events', () => {
    const unhandledEvent = 'UNHANDLED_EVENT' as InputSystemEvents

    const result = registry.decide(unhandledEvent, baseSnapshot)

    expect(result).toBeNull()
  })
})
