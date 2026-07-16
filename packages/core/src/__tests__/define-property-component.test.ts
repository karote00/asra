import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  definePropertyChildRelation,
  definePropertyComponent,
  getPropertyChildRelations,
  removePropertyChildRelation,
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
  RegistrationRelationError,
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

const expectRelationError = (
  run: () => unknown,
  code: RegistrationRelationError['code']
) => {
  try {
    run()
    throw new Error(`Expected RegistrationRelationError ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(RegistrationRelationError)
    expect((error as RegistrationRelationError).code).toBe(code)
  }
}

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

  it('should throw on duplicate property component registration', () => {
    definePropertyComponent({
      type: TEST_TYPE,
      constructor: TestPropertyComponent
    })

    expect(() =>
      definePropertyComponent({
        type: TEST_TYPE,
        constructor: TestPropertyComponent
      })
    ).toThrow(`Property component "${TEST_TYPE}" is already registered`)
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
      childIds: { id: string; x: number; y: number }[]
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

describe('property child relations', () => {
  beforeEach(() => {
    unregisterPropertyComponent(TEST_TYPE)
    unregisterPropertyComponent(TEST_CHILD_TYPE)
    propsManager.reset()
    definePropertyComponent({
      type: TEST_CHILD_TYPE,
      defaults: { x: 0 }
    })
    definePropertyComponent({
      type: TEST_TYPE,
      defaults: { childIds: [] },
      children: {
        key: 'childIds',
        childType: TEST_CHILD_TYPE
      }
    })
  })

  it('removes a child relation while preserving both property runtimes and disposing old subscriptions', () => {
    const Child = getPropertyComponent(TEST_CHILD_TYPE)
    const Parent = getPropertyComponent(TEST_TYPE)
    expect(Child).toBeDefined()
    expect(Parent).toBeDefined()
    if (!Child || !Parent) throw new Error('Expected property runtimes')

    const child = new Child({ id: 'relation-child', type: TEST_CHILD_TYPE })
    propsManager.addToMap(child)
    const parent = new Parent({
      id: 'relation-parent',
      type: TEST_TYPE,
      childIds: ['relation-child']
    } as Partial<PropertyComponentRawData>)
    propsManager.addToMap(parent)
    const staleParentListener = vi.fn()
    parent.on(staleParentListener)

    propsManager.reset()
    const result = removePropertyChildRelation(TEST_TYPE, 'childIds')

    expect(result).toMatchObject({
      ok: true,
      operation: 'remove-relation',
      source: { kind: 'property', key: TEST_TYPE },
      relation: {
        name: 'childIds',
        target: { kind: 'property', key: TEST_CHILD_TYPE }
      }
    })
    expect(getPropertyComponent(TEST_TYPE)).toBeDefined()
    expect(getPropertyComponent(TEST_CHILD_TYPE)).toBeDefined()
    expect(getPropertyChildRelations(TEST_TYPE)).toEqual([])

    child.set(
      'x' as keyof PropertyComponentInstanceDataTypes,
      4 as unknown as PropertyComponentInstanceDataTypes[keyof PropertyComponentInstanceDataTypes]
    )
    expect(staleParentListener).not.toHaveBeenCalled()

    propsManager.addToMap(child)
    const RebuiltParent = getPropertyComponent(TEST_TYPE)
    if (!RebuiltParent) throw new Error('Expected rebuilt parent runtime')
    const nextParent = new RebuiltParent({
      id: 'relation-parent-next',
      type: TEST_TYPE,
      childIds: ['relation-child']
    } as Partial<PropertyComponentRawData>)
    const nextParentListener = vi.fn()
    nextParent.on(nextParentListener)
    child.set(
      'x' as keyof PropertyComponentInstanceDataTypes,
      5 as unknown as PropertyComponentInstanceDataTypes[keyof PropertyComponentInstanceDataTypes]
    )
    expect(nextParentListener).not.toHaveBeenCalled()
  })

  it('defines the child relation again for future parent instances', () => {
    removePropertyChildRelation(TEST_TYPE, 'childIds')

    const result = definePropertyChildRelation(TEST_TYPE, {
      key: 'childIds',
      childType: TEST_CHILD_TYPE
    })

    expect(result).toMatchObject({
      ok: true,
      operation: 'define-relation',
      relation: {
        name: 'childIds',
        target: { kind: 'property', key: TEST_CHILD_TYPE }
      }
    })
    expect(getPropertyChildRelations(TEST_TYPE)).toEqual([
      expect.objectContaining({
        key: 'childIds',
        childType: TEST_CHILD_TYPE
      })
    ])

    const Child = getPropertyComponent(TEST_CHILD_TYPE)
    const Parent = getPropertyComponent(TEST_TYPE)
    if (!Child || !Parent) throw new Error('Expected property runtimes')
    const child = new Child({ id: 'relation-child', type: TEST_CHILD_TYPE })
    propsManager.addToMap(child)
    const parent = new Parent({
      id: 'relation-parent',
      type: TEST_TYPE,
      childIds: ['relation-child']
    } as Partial<PropertyComponentRawData>)
    const listener = vi.fn()
    parent.on(listener)

    child.set(
      'x' as keyof PropertyComponentInstanceDataTypes,
      6 as unknown as PropertyComponentInstanceDataTypes[keyof PropertyComponentInstanceDataTypes]
    )
    expect(listener).toHaveBeenCalledOnce()
  })

  it('fails before mutation for active and replay-retained parents and invalid relation operations', () => {
    expectRelationError(
      () =>
        definePropertyChildRelation(TEST_TYPE, {
          key: 'childIds',
          childType: TEST_CHILD_TYPE
        }),
      'DUPLICATE_RELATION'
    )
    expectRelationError(
      () => removePropertyChildRelation(TEST_TYPE, 'missing'),
      'RELATION_NOT_FOUND'
    )

    removePropertyChildRelation(TEST_TYPE, 'childIds')
    expectRelationError(
      () =>
        definePropertyChildRelation(TEST_TYPE, {
          key: 'missing',
          childType: 'missing-property-child'
        }),
      'RELATION_TARGET_NOT_FOUND'
    )
    definePropertyChildRelation(TEST_TYPE, {
      key: 'childIds',
      childType: TEST_CHILD_TYPE
    })

    const Parent = getPropertyComponent(TEST_TYPE)
    if (!Parent) throw new Error('Expected parent runtime')
    const parent = new Parent({ id: 'active-parent', type: TEST_TYPE })
    propsManager.addToMap(parent)
    expectRelationError(
      () => removePropertyChildRelation(TEST_TYPE, 'childIds'),
      'REGISTRATION_IN_USE'
    )

    propsManager.removeFromMap('active-parent')
    expectRelationError(
      () => removePropertyChildRelation(TEST_TYPE, 'childIds'),
      'REGISTRATION_IN_USE'
    )
    expect(getPropertyChildRelations(TEST_TYPE)).toHaveLength(1)
  })
})
