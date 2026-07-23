import { describe, expect, it } from 'vitest'
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
})
