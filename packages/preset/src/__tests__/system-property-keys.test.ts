import { describe, expect, it } from 'vitest'
import {
  InputSystemPropertyKeys,
  PRESET_SYSTEM_PROPERTY_KEYS,
  PresetSystemPropertyKeys,
  SelectionSystemPropertyKeys,
  VectorEditingSystemPropertyKeys,
  ViewportSystemPropertyKeys
} from '../system-property-keys'

describe('Preset system property keys', () => {
  it('exposes one frozen flattened contract derived from owner groups', () => {
    const groupedKeys = [
      ...Object.values(ViewportSystemPropertyKeys),
      ...Object.values(InputSystemPropertyKeys),
      ...Object.values(SelectionSystemPropertyKeys),
      ...Object.values(VectorEditingSystemPropertyKeys)
    ]

    expect(Object.values(PresetSystemPropertyKeys)).toEqual(groupedKeys)
    expect(PRESET_SYSTEM_PROPERTY_KEYS).toEqual(groupedKeys)
    expect(new Set(PRESET_SYSTEM_PROPERTY_KEYS).size).toBe(groupedKeys.length)
    expect(Object.isFrozen(PresetSystemPropertyKeys)).toBe(true)
    expect(Object.isFrozen(PRESET_SYSTEM_PROPERTY_KEYS)).toBe(true)
  })
})
