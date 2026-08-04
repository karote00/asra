import { describe, it, expect } from 'vitest'
import { isElementEntity, isGroupEntity } from '../entity-types.js'
import { EntityType, EntityTypes } from '../enum.js'

describe('Scene Tree Utils - Entity Type Classification', () => {
  describe('isElementEntity', () => {
    it('should identify valid entity type keys', () => {
      // Demonstrates: Function checks if input is a KEY in EntityTypes enum
      // This is used for validating entity type strings from external sources
      expect(isElementEntity('UNDEFINED' as EntityType)).toBe(true)
      expect(isElementEntity('WORKSPACE' as EntityType)).toBe(true)
      expect(isElementEntity('FRAME' as EntityType)).toBe(true)
      expect(isElementEntity('GROUP' as EntityType)).toBe(true)
      expect(isElementEntity('ELEMENT' as EntityType)).toBe(true)
    })

    it('should reject invalid entity types', () => {
      // Demonstrates: Type safety - what happens with invalid input
      expect(isElementEntity('INVALID_TYPE' as EntityType)).toBe(false)
      // Values are not keys, so they're invalid
      expect(isElementEntity('rect')).toBe(false) // 'rectangle' is not a key
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
      expect(isGroupEntity('rect')).toBe(false)
    })
  })
})
