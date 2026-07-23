import { describe, it, expect, beforeEach } from 'vitest'
import { interactionTargetRegistry } from '@asyra/render'
import {
  createRenderInteractionCircleTarget,
  createRenderInteractionPointTarget
} from '@asyra/render'

describe('InteractionTargetRegistry', () => {
  beforeEach(() => {
    interactionTargetRegistry.clear()
  })

  it('should hit test the highest zIndex target', () => {
    interactionTargetRegistry.register(
      createRenderInteractionPointTarget({
        id: 'target-low',
        type: 'handle',
        center: { x: 10, y: 10 },
        radius: 5,
        zIndex: 1
      })
    )

    interactionTargetRegistry.register(
      createRenderInteractionPointTarget({
        id: 'target-high',
        type: 'handle',
        center: { x: 10, y: 10 },
        radius: 5,
        zIndex: 10
      })
    )

    const hit = interactionTargetRegistry.hitTest({
      canvas: { x: 10, y: 10 },
      workspace: { x: 10, y: 10 }
    })

    expect(hit?.id).toBe('target-high')
  })

  it('uses the canonical point hit contract for circle targets', () => {
    const target = createRenderInteractionCircleTarget({
      id: 'circle',
      type: 'handle',
      center: { x: 10, y: 10 },
      radius: 5
    })

    expect(target.hitTest({ x: 13, y: 14 })).toBe(true)
    expect(target.hitTest({ x: 16, y: 10 })).toBe(false)
  })

  it('should update a target and reflect new hit test result', () => {
    interactionTargetRegistry.register(
      createRenderInteractionPointTarget({
        id: 'target-update',
        type: 'handle',
        center: { x: 5, y: 5 },
        radius: 2
      })
    )

    let hit = interactionTargetRegistry.hitTest({
      canvas: { x: 5, y: 5 },
      workspace: { x: 5, y: 5 }
    })
    expect(hit?.id).toBe('target-update')

    interactionTargetRegistry.update('target-update', {
      bounds: { minX: 100, minY: 100, maxX: 110, maxY: 110 },
      hitTest: () => false
    })

    hit = interactionTargetRegistry.hitTest({
      canvas: { x: 5, y: 5 },
      workspace: { x: 5, y: 5 }
    })
    expect(hit).toBe(null)
  })

  it('should override target registration when requested', () => {
    interactionTargetRegistry.register(
      createRenderInteractionPointTarget({
        id: 'target-override',
        type: 'handle',
        center: { x: 0, y: 0 },
        radius: 1,
        zIndex: 1
      })
    )

    interactionTargetRegistry.register(
      createRenderInteractionPointTarget({
        id: 'target-override',
        type: 'handle',
        center: { x: 0, y: 0 },
        radius: 1,
        zIndex: 99
      }),
      { override: true }
    )

    const hit = interactionTargetRegistry.hitTest({
      canvas: { x: 0, y: 0 },
      workspace: { x: 0, y: 0 }
    })

    expect(hit?.zIndex).toBe(99)
  })
})
