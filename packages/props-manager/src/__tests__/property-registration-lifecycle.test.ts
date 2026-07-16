import type { PropertySchema } from '@asyra/utils'
import { PropertyTypes } from '@asyra/utils'
import { beforeEach, describe, expect, it } from 'vitest'
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

  it('allows a clean custom redefinition after unregister', () => {
    class ReplacementComponent extends CustomComponent {}
    const manager = new PropsManager()
    registerDefault()

    expect(unregisterPropertyRegistration(TYPE, manager).ok).toBe(true)
    registerPropertySchema({ ...schema })
    registerPropertyComponent(TYPE, ReplacementComponent)

    expect(getPropertySchema(TYPE)).toEqual(schema)
    expect(getPropertyComponent(TYPE)).toBe(ReplacementComponent)
  })
})
