import { describe, it, expect, beforeEach } from 'vitest'
import { idCounter } from '../idCounter'
import { CODE_SPLIT, FIRST_ID } from '../constants'
import { IDTypes } from '../enum'

const addOne = (str: string): string => (Number(str) + 1).toString()

describe('idCounter', () => {
  beforeEach(() => {
    idCounter.clear()
  })

  describe('check current max number of id', () => {
    it('should return the current default id if type is not provided', () => {
      const currentId = idCounter.current()

      expect(currentId).toBe(FIRST_ID)
    })

    it('should return the current id for the specific type', () => {
      const type = IDTypes.ELEMENT

      const currentId = idCounter.current(type)

      const expectResult = `${type}${CODE_SPLIT}${FIRST_ID}`
      expect(currentId).toBe(expectResult)
    })

    it('should return undefined for an uninitialized type', () => {
      const type = 'UNKNOWN_TYPE'

      const currentId = idCounter.current(type)

      expect(currentId).toBe(undefined)
    })
  })

  describe('get new id', () => {
    it('should return a new id when type is not specified', () => {
      const currentId = idCounter.current()

      const newId = idCounter.increase()

      const expectResult = addOne(currentId)
      expect(newId).toBe(expectResult)
    })

    it('should return a new id for the specific type', () => {
      const type = IDTypes.WORKSPACE
      const currentId = idCounter.current(type)

      const newId = idCounter.increase(type)

      const next = addOne(currentId.split(CODE_SPLIT)[1])
      const expectResult = `${type}${CODE_SPLIT}${next}`
      expect(newId).toBe(expectResult)
    })

    it('should create and return a new id for a custom type', () => {
      const type = 'CUSTOM_TEST_TYPE'

      const newId = idCounter.increase(type)

      // First call initializes to 0 and increments to 1
      const expectResult = `${type}${CODE_SPLIT}${addOne(FIRST_ID)}`
      expect(newId).toBe(expectResult)

      // Second call should increment to 2
      const secondId = idCounter.increase(type)
      const expectSecond = `${type}${CODE_SPLIT}${addOne(addOne(FIRST_ID))}`
      expect(secondId).toBe(expectSecond)
    })

    it('should initialize and synchronize an uninitialized type when load is called', () => {
      const type = 'NEW_TYPE'
      const testId = `${type}${CODE_SPLIT}10`

      idCounter.load(testId, type)

      expect(idCounter.current(type)).toBe(testId)

      const newId = idCounter.increase(type)
      expect(newId).toBe(`${type}${CODE_SPLIT}11`)
    })

    it('keeps actor-scoped counters distinct without adopting another actor counter', () => {
      idCounter.setNamespace('actor-a')

      expect(idCounter.increase(IDTypes.ELEMENT)).toBe('el-actor-a-1')
      expect(idCounter.valid('el-actor-b-99', IDTypes.ELEMENT)).toBe(true)

      idCounter.load('el-actor-b-99', IDTypes.ELEMENT)

      expect(idCounter.increase(IDTypes.ELEMENT)).toBe('el-actor-a-2')
    })
  })

  describe('valid id', () => {
    it('should returns true for a numeric string id when type is not specified', () => {
      const testId = '5'

      const result = idCounter.valid(testId)

      expect(result).toBe(true)
    })

    it('should returns false for a non-numeric string id when type is not specified', () => {
      const testId = 'test'

      const result = idCounter.valid(testId)

      expect(result).toBe(false)
    })

    it('should return true for a numberic string id when type is specified', () => {
      const testId = 'el-6'

      const result = idCounter.valid(testId, IDTypes.ELEMENT)

      expect(result).toBe(true)
    })

    it('should return true for a custom type', () => {
      const type = 'UNKNOWN'
      const testId = `${type}-8`

      const result = idCounter.valid(testId, type)

      expect(result).toBe(true)
    })

    it('should return false if the numeric part of the id is not valid', () => {
      const testId = 'el-UNKNOWN'

      const result = idCounter.valid(testId, IDTypes.ELEMENT)

      expect(result).toBe(false)
    })

    it('should return false if the prefix of the id does not match the specified type', () => {
      const testId = 'el-3'

      const result = idCounter.valid(testId, IDTypes.WORKSPACE)

      expect(result).toBe(false)
    })

    it('rejects an empty namespace segment', () => {
      expect(idCounter.valid('el--1', IDTypes.ELEMENT)).toBe(false)
    })
  })

  describe('register/unregister type', () => {
    it('should unregister a registered custom type', () => {
      const type = 'CUSTOM_TEST_TYPE'
      idCounter.registerType(type, type)
      expect(idCounter.hasType(type)).toBe(true)

      const result = idCounter.unregisterType(type)

      expect(result).toBe(true)
      expect(idCounter.hasType(type)).toBe(false)
      expect(idCounter.current(type)).toBe(undefined)
    })

    it('should return false when unregistering unknown type', () => {
      expect(idCounter.unregisterType('UNKNOWN_TYPE')).toBe(false)
    })
  })
})
