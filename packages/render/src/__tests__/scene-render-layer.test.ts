import { afterEach, describe, expect, it, vi } from 'vitest'
import { RenderLayer } from '../layers/scene/index.js'
import renderStrategyRegistry from '../registries/render-strategy.js'
import type { RenderElementData } from '../types.js'
import { setElementGeometryLocalBounds } from '@asyra/utils'

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

  it('projects scale and skew as direct affine properties without rerendering geometry', () => {
    const strategy = vi.fn((graphic) => {
      graphic.moveTo(0, 0).lineTo(80, 40)
      setElementGeometryLocalBounds(graphic, {
        x: 0,
        y: 0,
        width: 80,
        height: 40
      })
    })
    renderStrategyRegistry.register(NESTED_TEST_TYPE, strategy)
    const layer = new RenderLayer()
    layer.switchWorkspace({ label: 'workspace', x: 0, y: 0 })
    const element = layer.addElement({
      id: 'vector-affine',
      type: NESTED_TEST_TYPE,
      parentId: 'workspace',
      name: 'Affine Vector',
      visible: true,
      lock: false,
      x: 20,
      y: 30,
      width: 80,
      height: 40,
      rotation: 0
    } as unknown as RenderElementData)
    if (!element) {
      throw new Error('Expected affine Vector render element')
    }
    strategy.mockClear()

    layer.updateElementProperties(element, 'x', 20)
    layer.updateElementProperties(element, 'y', 30)
    layer.updateElementProperties(element, 'scaleX', 2)
    layer.updateElementProperties(element, 'scaleY', 3)
    layer.updateElementProperties(element, 'skewX', 0.2)
    layer.updateElementProperties(element, 'skewY', 0.1)
    layer.updateElementProperties(element, 'width', 160)

    expect(strategy).not.toHaveBeenCalled()
    expect(element.scale).toMatchObject({ x: 2, y: 3 })
    expect(
      (
        element as unknown as {
          skew: { x: number; y: number }
        }
      ).skew
    ).toMatchObject({ x: 0.2, y: 0.1 })
    expect(element.worldTransform).toMatchObject({
      a: Math.cos(0.1) * 4,
      b: Math.sin(0.1) * 4,
      c: Math.sin(0.2) * 3,
      d: Math.cos(0.2) * 3,
      tx: 20,
      ty: 30
    })
  })
})
