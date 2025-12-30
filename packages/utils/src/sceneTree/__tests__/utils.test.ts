import { describe, it, expect } from 'vitest'
import { isElementEntity, isGroupEntity } from '../utils'
import { EntityTypes } from '../enum'

describe('Scene Tree Utils - Entity Type Classification', () => {
  describe('isElementEntity', () => {
    it('should identify valid entity type keys', () => {
      // Demonstrates: Function checks if input is a KEY in EntityTypes enum
      // This is used for validating entity type strings from external sources
      expect(isElementEntity('RECTANGLE' as EntityTypes)).toBe(true)
      expect(isElementEntity('WORKSPACE' as EntityTypes)).toBe(true)
      expect(isElementEntity('FRAME' as EntityTypes)).toBe(true)
      expect(isElementEntity('GROUP' as EntityTypes)).toBe(true)
    })

    it('should reject invalid entity types', () => {
      // Demonstrates: Type safety - what happens with invalid input
      expect(isElementEntity('INVALID_TYPE' as EntityTypes)).toBe(false)
      // Values are not keys, so they're invalid
      expect(isElementEntity(EntityTypes.RECTANGLE)).toBe(false) // 'rectangle' is not a key
    })
  })

  describe('isGroupEntity', () => {
    it('should identify container entities that can hold other elements', () => {
      // Demonstrates: Which entities can contain other elements (critical for hierarchy)
      expect(isGroupEntity(EntityTypes.WORKSPACE)).toBe(true)
      expect(isGroupEntity(EntityTypes.FRAME)).toBe(true)
      expect(isGroupEntity(EntityTypes.GROUP)).toBe(true)
    })

    it('should reject leaf entities that cannot contain other elements', () => {
      // Demonstrates: Which entities are leaf nodes (cannot have children)
      expect(isGroupEntity(EntityTypes.RECTANGLE)).toBe(false)
    })
  })
})
