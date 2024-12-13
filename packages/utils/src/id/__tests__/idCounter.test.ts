import { describe, it, expect } from 'vitest'
import { idCounter } from '../idCounter'
import { CODE_SPLIT, FIRST_ID } from '../constants'
import { ID_TYPES } from '../enum'

const addOne = (str: string): string => (Number(str) + 1).toString()

describe('idCounter:', () => {
  describe('check current max number of id', () => {
    it('should return current default id if type is not provided', () => {
      const currentId = idCounter.current()

      expect(currentId).toBe(FIRST_ID)
    })

    it('should return current id with specific type', () => {
      const type = ID_TYPES.ELEMENT

      const currentId = idCounter.current(type)

      const expectResult = `${type}${CODE_SPLIT}${FIRST_ID}`
      expect(currentId).toBe(expectResult)
    })

    it('should return undefined if the type is invalid', () => {
      const type = 'UNKNOWN_TYPE'

      const currentId = idCounter.current(type)

      expect(currentId).toBe(undefined)
    })
  })

  describe('get new id:', () => {
    it('should return new id if type is not provided', () => {
      const currentId = idCounter.current()

      const newId = idCounter.increase()

      const expectResult = addOne(currentId)
      expect(newId).toBe(expectResult)
    })

    it('should return new id with specific type', () => {
      const type = ID_TYPES.WORKSPACE
      const currentId = idCounter.current(type)

      const newId = idCounter.increase(type)

      const next = addOne(currentId.split(CODE_SPLIT)[1])
      const expectResult = `${type}${CODE_SPLIT}${next}`
      expect(newId).toBe(expectResult)
    })

    it('should return empty string if the type is invalid', () => {
      const type = 'UNKNOWN_TYPE'

      const newId = idCounter.increase(type)

      expect(newId).toBe('')
    })
  })

  describe('valid id', () => {
    it('should returns true for a numeric string id when no type is provided', () => {
      const testId = '5'

      const result = idCounter.valid(testId)

      expect(result).toBe(true)
    })

    it('should returns false when id is not a numeric string and no type is provided', () => {
      const testId = 'test'

      const result = idCounter.valid(testId)

      expect(result).toBe(false)
    })

    it('should return true for a numberic string id when type is specified', () => {
      const testId = 'el-6'

      const result = idCounter.valid(testId, ID_TYPES.ELEMENT)

      expect(result).toBe(true)
    })

    it('should return false if is invalid type', () => {
      const type = 'UNKNOWN'
      const testId = `${type}-8`

      const result = idCounter.valid(testId, type)

      expect(result).toBe(false)
    })

    it('should return false if the number of id is not a number', () => {
      const testId = 'el-UNKNOWN'

      const result = idCounter.valid(testId, ID_TYPES.ELEMENT)

      expect(result).toBe(false)
    })

    it('should return false if the key of id is different of type', () => {
      const testId = 'el-3'

      const result = idCounter.valid(testId, ID_TYPES.WORKSPACE)

      expect(result).toBe(false)
    })
  })
})
