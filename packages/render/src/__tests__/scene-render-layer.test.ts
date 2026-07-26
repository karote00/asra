import { afterEach, describe, expect, it } from 'vitest'
import { RenderLayer } from '../layers/scene'
import renderStrategyRegistry from '../registries/render-strategy'
import type { RenderElementData } from '../types'

const NESTED_TEST_TYPE = 'nested-render-order-test'

afterEach(() => {
  renderStrategyRegistry.unregister(NESTED_TEST_TYPE)
})

describe('scene RenderLayer hierarchy projection', () => {
  it('places a nested element before invoking its render strategy', () => {
    const observedParentLabels: (string | null)[] = []
    renderStrategyRegistry.register(NESTED_TEST_TYPE, (graphic) => {
      observedParentLabels.push(graphic.parent?.label ?? null)
    })
    const layer = new RenderLayer()
    layer.switchWorkspace({ label: 'workspace', x: 0, y: 0 })
    layer.addElement({
      id: 'group-1',
      type: 'group',
      parentId: 'workspace',
      name: 'Group',
      visible: true,
      lock: false,
      x: 100,
      y: 120,
      width: 200,
      height: 180,
      rotation: 0
    } as unknown as RenderElementData)

    layer.addElement({
      id: 'nested-vector',
      type: NESTED_TEST_TYPE,
      parentId: 'group-1',
      name: 'Nested Vector',
      visible: true,
      lock: false,
      x: 20,
      y: 30,
      width: 80,
      height: 40,
      rotation: 0
    } as unknown as RenderElementData)

    expect(observedParentLabels).toEqual(['group-1'])
  })
})
