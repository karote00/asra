import propsManager, {
  BasePropertyComponent,
  propertyComponentRegistry,
  registerPropertyComponent
} from '@asyra/props-manager'
import type { ComputedAttrs, DataTypes, Unit } from '@asyra/utils'
import { beforeEach, describe, expect, it } from 'vitest'
import sceneTree from '../sceneTree'
import Computed from '../components/computed'
import { createDynamicPropsClass } from '../create-dynamic-props'

const CUSTOM_TYPE = 'scene-tree-custom-property'

interface CustomPropertyData {
  id: string
  type: string
  customCount: number
  internalLabel: string
}

type CustomComputedData = ComputedAttrs & { customCount: number }

class CustomPropertyComponent extends BasePropertyComponent<CustomPropertyData> {
  data: CustomPropertyData = {
    id: '',
    type: CUSTOM_TYPE,
    customCount: 1,
    internalLabel: 'not-projected'
  }

  constructor(data: Partial<CustomPropertyData>) {
    super()
    this.data = { ...this.data, ...data, type: CUSTOM_TYPE }
  }

  load(data: Partial<CustomPropertyData>): void {
    this.data = { ...this.data, ...data, type: CUSTOM_TYPE }
  }

  getValue(): Record<string, DataTypes> {
    return { customCount: this.data.customCount }
  }

  getUnit(): Record<string, Unit> {
    return {}
  }
}

describe('Scene Tree canonical property projection', () => {
  beforeEach(() => {
    sceneTree.reset()
    propsManager.reset()
    propertyComponentRegistry.clear()
    registerPropertyComponent(CUSTOM_TYPE, CustomPropertyComponent)
  })

  it('projects only complete getValue output during setup and subscriptions', () => {
    const Props = createDynamicPropsClass([
      {
        name: 'style',
        type: CUSTOM_TYPE,
        alias: ['customCount', 'removedField']
      }
    ])
    const elementProps = new Props('custom-element')
    const computed = new Computed<CustomComputedData>(
      'custom-element',
      elementProps,
      ['style']
    )
    const propertyId = elementProps.getPropId('style')

    expect(propertyId).toBeDefined()
    expect(computed.get('customCount')).toBe(1)
    expect(computed.save()).not.toHaveProperty('internalLabel')
    expect(computed.save()).not.toHaveProperty('removedField')

    const property = propsManager.getPropertyById(
      propertyId as string
    ) as CustomPropertyComponent
    property.set('customCount', 7)

    expect(computed.get('customCount')).toBe(7)
    expect(computed.save()).not.toHaveProperty('internalLabel')
    expect(computed.save()).not.toHaveProperty('removedField')
  })

  it('bypasses projection when the component has no property relation', () => {
    const Props = createDynamicPropsClass([])
    const elementProps = new Props('unrelated-element')
    const computed = new Computed('unrelated-element', elementProps, [])

    expect(computed.save()).not.toHaveProperty('customCount')
  })
})
