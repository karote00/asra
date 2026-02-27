import { beforeEach, describe, expect, it } from 'vitest'
import {
  definePropertyComponent,
  unregisterPropertyComponent
} from '../define-property-component'
import {
  BasePropertyComponent,
  getPropertyComponent
} from '@asyra/props-manager'
import propsManager from '@asyra/props-manager'
import {
  type DataTypes,
  type PropertyComponentInstanceDataTypes,
  type PropertyComponentRawData,
  PropertyTypes,
  Unit
} from '@asyra/utils'

const TEST_TYPE = 'test-property-type'
const TEST_CHILD_TYPE = 'test-property-child-type'

class TestPropertyComponent extends BasePropertyComponent<PropertyComponentInstanceDataTypes> {
  data: PropertyComponentInstanceDataTypes = {
    id: '',
    type: TEST_TYPE
  }

  constructor(data: Partial<PropertyComponentInstanceDataTypes>) {
    super()
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.data.type = TEST_TYPE
  }

  load(data: PropertyComponentRawData): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
  }

  save(): PropertyComponentRawData {
    return {
      ...super.save()
    } as PropertyComponentRawData
  }

  getValue(): Record<string, DataTypes> {
    return {}
  }

  getUnit(): Record<string, Unit> {
    return {}
  }
}

class OverrideTestPropertyComponent extends TestPropertyComponent {}

describe('definePropertyComponent', () => {
  beforeEach(() => {
    unregisterPropertyComponent(TEST_TYPE)
    unregisterPropertyComponent(TEST_CHILD_TYPE)
    propsManager.reset()
  })

  it('should register property component constructor by type', () => {
    definePropertyComponent({
      type: TEST_TYPE,
      constructor: TestPropertyComponent
    })

    expect(getPropertyComponent(TEST_TYPE)).toBe(TestPropertyComponent)
  })

  it('should support override option', () => {
    definePropertyComponent({
      type: TEST_TYPE,
      constructor: TestPropertyComponent
    })

    definePropertyComponent({
      type: TEST_TYPE,
      constructor: OverrideTestPropertyComponent,
      options: {
        override: true
      }
    })

    expect(getPropertyComponent(TEST_TYPE)).toBe(OverrideTestPropertyComponent)
  })

  it('should support config-based property component definition', () => {
    definePropertyComponent({
      type: TEST_TYPE,
      defaults: {
        foo: 10,
        barUnit: Unit.PX
      }
    })

    const ComponentCtor = getPropertyComponent(TEST_TYPE)
    expect(ComponentCtor).toBeDefined()
    if (!ComponentCtor) {
      return
    }

    const component = new ComponentCtor({
      id: 'pp-test',
      type: TEST_TYPE
    })

    expect(
      component.get('foo' as keyof PropertyComponentInstanceDataTypes)
    ).toBe(10)
    expect(component.getValue()).toEqual({ foo: 10 })
    expect(
      (
        component as unknown as { getUnit: () => Record<string, Unit> }
      ).getUnit()
    ).toEqual({ barUnit: Unit.PX })
    expect(component.save()).toEqual({
      id: 'pp-test',
      type: TEST_TYPE,
      foo: 10,
      barUnit: Unit.PX
    })
  })

  it('should support dynamic keys in config-based property component', () => {
    definePropertyComponent({
      type: TEST_TYPE,
      allowDynamicKeys: true
    })

    const ComponentCtor = getPropertyComponent(TEST_TYPE)
    expect(ComponentCtor).toBeDefined()
    if (!ComponentCtor) {
      return
    }

    const component = new ComponentCtor({
      id: 'pp-dynamic',
      type: TEST_TYPE,
      foo: 1
    } as Partial<PropertyComponentRawData>)

    expect(component.getValue()).toEqual({ foo: 1 })
    expect(component.save()).toEqual({
      id: 'pp-dynamic',
      type: TEST_TYPE,
      foo: 1
    })

    component.set(
      'bar' as keyof PropertyComponentInstanceDataTypes,
      2 as unknown as PropertyComponentInstanceDataTypes[keyof PropertyComponentInstanceDataTypes]
    )
    expect(component.getValue()).toEqual({ foo: 1, bar: 2 })
  })

  it('should support children config with id-only persistence', () => {
    definePropertyComponent({
      type: TEST_CHILD_TYPE,
      defaults: {
        x: 0,
        y: 0
      }
    })

    definePropertyComponent({
      type: TEST_TYPE,
      defaults: {
        childIds: []
      },
      children: {
        key: 'childIds',
        childType: TEST_CHILD_TYPE,
        mode: 'ids-or-objects',
        toChildData: (item) => ({
          id: typeof item.id === 'string' ? item.id : undefined,
          x: typeof item.x === 'number' ? item.x : 0,
          y: typeof item.y === 'number' ? item.y : 0
        })
      }
    })

    const ParentCtor = getPropertyComponent(TEST_TYPE)
    expect(ParentCtor).toBeDefined()
    if (!ParentCtor) {
      return
    }

    const parent = new ParentCtor({
      id: 'pp-parent',
      type: TEST_TYPE,
      childIds: [{ x: 11, y: 22 }]
    } as Partial<PropertyComponentRawData>)

    const saved = parent.save() as unknown as {
      childIds: string[]
    }
    expect(Array.isArray(saved.childIds)).toBe(true)
    expect(saved.childIds).toHaveLength(1)
    expect(typeof saved.childIds[0]).toBe('string')

    const child = propsManager.getPropertyById(saved.childIds[0])
    expect(child).toBeDefined()
    expect(child?.get('x' as keyof PropertyComponentInstanceDataTypes)).toBe(11)
    expect(child?.get('y' as keyof PropertyComponentInstanceDataTypes)).toBe(22)
  })

  it('should support children value projection from child ids', () => {
    definePropertyComponent({
      type: TEST_CHILD_TYPE,
      defaults: {
        x: 0,
        y: 0
      }
    })

    definePropertyComponent({
      type: TEST_TYPE,
      defaults: {
        childIds: []
      },
      children: {
        key: 'childIds',
        childType: TEST_CHILD_TYPE,
        mode: 'ids-or-objects',
        toChildData: (item) => ({
          x: typeof item.x === 'number' ? item.x : 0,
          y: typeof item.y === 'number' ? item.y : 0
        }),
        toValue: (child, childId) => ({
          id: childId,
          x: child.get('x'),
          y: child.get('y')
        })
      }
    })

    const ParentCtor = getPropertyComponent(TEST_TYPE)
    expect(ParentCtor).toBeDefined()
    if (!ParentCtor) {
      return
    }

    const parent = new ParentCtor({
      id: 'pp-parent',
      type: TEST_TYPE,
      childIds: [{ x: 1, y: 2 }]
    } as unknown as Partial<PropertyComponentRawData>)

    const value = parent.getValue() as unknown as {
      childIds: Array<{ id: string; x: number; y: number }>
    }

    expect(value.childIds).toHaveLength(1)
    expect(value.childIds[0].x).toBe(1)
    expect(value.childIds[0].y).toBe(2)
    expect(typeof value.childIds[0].id).toBe('string')
  })
})

describe('unregisterPropertyComponent', () => {
  beforeEach(() => {
    unregisterPropertyComponent(TEST_TYPE)
    unregisterPropertyComponent(TEST_CHILD_TYPE)
    propsManager.reset()
  })

  it('should unregister existing property component', () => {
    definePropertyComponent({
      type: TEST_TYPE,
      constructor: TestPropertyComponent
    })

    const result = unregisterPropertyComponent(TEST_TYPE)

    expect(result).toBe(true)
    expect(getPropertyComponent(TEST_TYPE)).toBeUndefined()
  })

  it('should return false for unknown property component type', () => {
    expect(unregisterPropertyComponent('unknown-property-type')).toBe(false)
  })
})
