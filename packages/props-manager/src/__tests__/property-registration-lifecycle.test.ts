import type { PropertySchema } from '@asyra/utils'
import { PropertyTypes } from '@asyra/utils'
import { beforeEach, describe, expect, it } from 'vitest'
import * as propsManagerPublic from '../index'
import {
  getPropertyComponent,
  getPropertySchema,
  propertyComponentRegistry,
  propertySchemaRegistry,
  PropertyRegistrationError,
  registerPropertyComponent,
  registerPropertySchema,
  unregisterPropertyRegistration
} from '../index'
import { PropsManager } from '../manager/props-manager'
import { CustomComponent } from './helpers/test-property-components'

const TYPE = PropertyTypes.CUSTOM

const schema: PropertySchema = {
  type: TYPE,
  fields: [
    {
      key: 'value',
      kind: 'number',
      defaultValue: 0
    }
  ]
}

const registerDefault = () => {
  registerPropertySchema(schema)
  registerPropertyComponent(TYPE, CustomComponent)
}

describe('property registration lifecycle', () => {
  beforeEach(() => {
    propertySchemaRegistry.clear()
    propertyComponentRegistry.clear()
  })

  it('rejects unregister before partial cleanup when an active instance uses the type', () => {
    const manager = new PropsManager()
    registerDefault()
    manager.addToMap(new CustomComponent({ id: 'active-property', type: TYPE }))

    expect(() => unregisterPropertyRegistration(TYPE, manager)).toThrowError(
      expect.objectContaining<Partial<PropertyRegistrationError>>({
        code: 'PROPERTY_TYPE_IN_USE',
        type: TYPE,
        propertyIds: ['active-property']
      })
    )
    expect(getPropertySchema(TYPE)).toBe(schema)
    expect(getPropertyComponent(TYPE)).toBe(CustomComponent)
  })

  it('treats deleted instances retained for replay as active usage', () => {
    const manager = new PropsManager()
    registerDefault()
    manager.addToDeletedMap(
      new CustomComponent({ id: 'deleted-property', type: TYPE })
    )

    expect(() => unregisterPropertyRegistration(TYPE, manager)).toThrowError(
      expect.objectContaining<Partial<PropertyRegistrationError>>({
        code: 'PROPERTY_TYPE_IN_USE',
        type: TYPE,
        propertyIds: ['deleted-property']
      })
    )
    expect(getPropertySchema(TYPE)).toBe(schema)
    expect(getPropertyComponent(TYPE)).toBe(CustomComponent)
  })

  it('returns a structured missing result without mutating other registrations', () => {
    const manager = new PropsManager()
    registerDefault()

    expect(
      unregisterPropertyRegistration('missing-property-type', manager)
    ).toEqual({
      ok: false,
      code: 'PROPERTY_REGISTRATION_NOT_FOUND',
      type: 'missing-property-type',
      removedSchema: false,
      removedComponent: false
    })
    expect(getPropertySchema(TYPE)).toBe(schema)
    expect(getPropertyComponent(TYPE)).toBe(CustomComponent)
  })

  it('removes schema and runtime constructor together when no instance uses the type', () => {
    const manager = new PropsManager()
    registerDefault()

    expect(unregisterPropertyRegistration(TYPE, manager)).toEqual({
      ok: true,
      type: TYPE,
      removedSchema: true,
      removedComponent: true
    })
    expect(getPropertySchema(TYPE)).toBeUndefined()
    expect(getPropertyComponent(TYPE)).toBeUndefined()
  })

  it('removes only the requested schema registration for target-owned cleanup', () => {
    const manager = new PropsManager()
    registerDefault()

    expect(unregisterPropertyRegistration(TYPE, manager, 'schema')).toEqual({
      ok: true,
      type: TYPE,
      removedSchema: true,
      removedComponent: false
    })
    expect(getPropertySchema(TYPE)).toBeUndefined()
    expect(getPropertyComponent(TYPE)).toBe(CustomComponent)
  })

  it('removes only the requested runtime registration for target-owned cleanup', () => {
    const manager = new PropsManager()
    registerDefault()

    expect(unregisterPropertyRegistration(TYPE, manager, 'runtime')).toEqual({
      ok: true,
      type: TYPE,
      removedSchema: false,
      removedComponent: true
    })
    expect(getPropertySchema(TYPE)).toBe(schema)
    expect(getPropertyComponent(TYPE)).toBeUndefined()
  })

  it.each(['schema', 'runtime'] as const)(
    'guards %s cleanup before changing either registry while the type is in use',
    (scope) => {
      const manager = new PropsManager()
      registerDefault()
      manager.addToMap(
        new CustomComponent({ id: `${scope}-active-property`, type: TYPE })
      )

      expect(() =>
        unregisterPropertyRegistration(TYPE, manager, scope)
      ).toThrowError(
        expect.objectContaining<Partial<PropertyRegistrationError>>({
          code: 'PROPERTY_TYPE_IN_USE',
          type: TYPE,
          propertyIds: [`${scope}-active-property`]
        })
      )
      expect(getPropertySchema(TYPE)).toBe(schema)
      expect(getPropertyComponent(TYPE)).toBe(CustomComponent)
    }
  )

  it('allows a clean custom redefinition after unregister', () => {
    class RedefinedComponent extends CustomComponent {}
    const manager = new PropsManager()
    registerDefault()

    expect(unregisterPropertyRegistration(TYPE, manager).ok).toBe(true)
    registerPropertySchema({ ...schema })
    registerPropertyComponent(TYPE, RedefinedComponent)

    expect(getPropertySchema(TYPE)).toEqual(schema)
    expect(getPropertyComponent(TYPE)).toBe(RedefinedComponent)
  })

  it('does not expose replacement semantics through the public package registry', () => {
    expect(propertyComponentRegistry).not.toHaveProperty('replace')
    expect(propertyComponentRegistry).not.toHaveProperty('rebuild')
    expect(propsManagerPublic).not.toHaveProperty(
      'replacePropertyComponentRegistration'
    )
    expect(propsManagerPublic).not.toHaveProperty(
      'rebuildPropertyComponentRegistration'
    )
  })
})
