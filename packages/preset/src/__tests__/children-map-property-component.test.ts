import { describe, expect, it } from 'vitest'
import core from '@asyra/core'
import { PropertyTypes, type SetterChangeRecord } from '@asyra/utils'
import { vectorPointsPropertyComponentDefinition } from '../props/components/vector-points-component'

const createVectorPointsComponent = () => {
  if (!('constructor' in vectorPointsPropertyComponentDefinition)) {
    throw new Error('Vector points property requires a constructor definition')
  }

  return new vectorPointsPropertyComponentDefinition.constructor({
    id: 'vector-points-parent',
    type: PropertyTypes.VECTOR_POINTS
  })
}

describe('children-map property component', () => {
  it('records the parent child-id reference update after resolving children', () => {
    const component = createVectorPointsComponent()
    const changes: SetterChangeRecord[] = []
    component.on((change) => changes.push(change))

    component.set('points', ['vector-point-a'])

    expect(changes).toEqual([
      expect.objectContaining({
        id: 'vector-points-parent',
        key: 'points',
        before: [],
        after: ['vector-point-a']
      })
    ])
  })

  it('projects child values from the issuing Props Manager', () => {
    const PropsManager = core.deps.props
      .constructor as new () => typeof core.deps.props
    const createChild = (value: number) =>
      ({
        get: (key: string) => {
          if (key === 'id') return 'shared-point'
          if (key === 'type') return PropertyTypes.VECTOR_POINT
          if (key === 'kind') return 'anchor'
          if (key === 'x') return value
          if (key === 'y') return 0
          if (key === 'anchorType') return 'sharp'
          if (key === 'handleMode') return 'none'
        },
        on: () => () => undefined
      }) as never
    const createComposition = (value: number) => {
      const manager = new PropsManager()
      manager.addToMap(createChild(value))
      const parent = createVectorPointsComponent()
      parent.load({
        id: 'vector-points-parent',
        type: PropertyTypes.VECTOR_POINTS,
        points: ['shared-point']
      })
      manager.addToMap(parent)
      manager.cleanChanges()
      return { manager, parent }
    }
    const first = createComposition(1)
    const second = createComposition(2)

    expect(first.parent.getValue().points).toEqual({
      'shared-point': expect.objectContaining({ id: 'shared-point', x: 1 })
    })
    expect(second.parent.getValue().points).toEqual({
      'shared-point': expect.objectContaining({ id: 'shared-point', x: 2 })
    })
  })
})
