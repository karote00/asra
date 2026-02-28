import { describe, it, expect, beforeEach } from 'vitest'
import { nameCounter } from '../nameCounter'
import { CODE_SPLIT, FIRST_NAME } from '../constants'
import { NameTypes } from '../enum'
import { capitalizeFirstLetter } from '../../helpers'

const addOne = (str: string): string => (Number(str) + 1).toString()

describe('nameCounter', () => {
  beforeEach(() => {
    nameCounter.clear()
  })

  describe('check current max number of name', () => {
    it('should return the current name for the specific type', () => {
      const type = NameTypes.ELEMENT

      const currentName = nameCounter.current(type)

      const expectResult = `${capitalizeFirstLetter(type)}${CODE_SPLIT}${FIRST_NAME}`
      expect(currentName).toBe(expectResult)
    })
  })

  describe('get new name', () => {
    it('should return a new name for the specific type', () => {
      const type = NameTypes.WORKSPACE
      const currentName = nameCounter.current(type)

      const newName = nameCounter.increase(type)

      const next = addOne(currentName.split(CODE_SPLIT)[1])
      const expectResult = `${capitalizeFirstLetter(type)}${CODE_SPLIT}${next}`
      expect(newName).toBe(expectResult)
    })
  })

  describe('valid name', () => {
    it('should return true for a valid name with a number when the type is specified', () => {
      const testName = 'Element 6'

      const result = nameCounter.valid(testName, NameTypes.ELEMENT)

      expect(result).toBe(true)
    })

    it('should return false if the numeric of the name is not valid', () => {
      const testName = 'Element UNKNOWN'

      const result = nameCounter.valid(testName, NameTypes.ELEMENT)

      expect(result).toBe(false)
    })

    it('should return false if the prefix of name does not match the specified type', () => {
      const testName = 'Element 3'

      const result = nameCounter.valid(testName, NameTypes.WORKSPACE)

      expect(result).toBe(false)
    })
  })

  describe('register/unregister type', () => {
    it('should unregister a registered custom type', () => {
      const type = 'custom_name_type'
      nameCounter.registerType(type, 'Custom')
      expect(nameCounter.hasType(type)).toBe(true)

      const result = nameCounter.unregisterType(type)

      expect(result).toBe(true)
      expect(nameCounter.hasType(type)).toBe(false)
      expect(nameCounter.current(type)).toBe(undefined)
    })

    it('should return false when unregistering unknown type', () => {
      expect(nameCounter.unregisterType('unknown_name_type')).toBe(false)
    })
  })
})
