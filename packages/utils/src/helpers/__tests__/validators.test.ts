import { describe, it, expect } from 'vitest'
import { isNumber, arrEqual } from '../validators'

describe('Validators - Input Validation for Design Tools', () => {
  describe('isNumber', () => {
    it('should validate numeric inputs for element properties', () => {
      // Demonstrates: How user input for positions/sizes is validated
      expect(isNumber('100')).toBe(true) // Valid position input
      expect(isNumber('3.14')).toBe(true) // Valid decimal input
      expect(isNumber(42)).toBe(true) // Direct number input
      expect(isNumber('0')).toBe(true) // Zero is valid
      expect(isNumber('-50')).toBe(true) // Negative positions allowed
    })

    it('should reject invalid numeric inputs', () => {
      // Demonstrates: What inputs are rejected to prevent errors
      expect(isNumber('abc')).toBe(false) // Text input
      expect(isNumber('100px')).toBe(false) // CSS-style input (not allowed)
      expect(isNumber('NaN')).toBe(false) // Invalid number string
      expect(isNumber('Infinity')).toBe(false) // Infinity not allowed

      // Note: Empty string converts to 0, so it's considered valid by isFinite
      // This demonstrates the actual behavior of the validator
      expect(isNumber('')).toBe(true) // Empty string -> 0 (valid)
    })
  })

  describe('arrEqual', () => {
    it('should compare element arrays for change detection', () => {
      // Demonstrates: How array changes are detected (critical for undo/redo)
      const selection1 = ['rect-1', 'rect-2', 'rect-3']
      const selection2 = ['rect-1', 'rect-2', 'rect-3']
      const selection3 = ['rect-1', 'rect-2']

      expect(arrEqual(selection1, selection2)).toBe(true) // Same selection
      expect(arrEqual(selection1, selection3)).toBe(false) // Different selection
    })

    it('should handle different data types in arrays', () => {
      // Demonstrates: Flexibility for different array comparison needs
      expect(arrEqual([1, 2, 3], [1, 2, 3])).toBe(true)
      expect(arrEqual(['a', 'b'], ['a', 'b'])).toBe(true)
      expect(arrEqual([true, false], [true, false])).toBe(true)

      // Order matters
      expect(arrEqual([1, 2, 3], [3, 2, 1])).toBe(false)
    })

    it('should handle edge cases in array comparison', () => {
      // Demonstrates: Edge cases that might occur in real usage
      expect(arrEqual([], [])).toBe(true) // Empty arrays
      expect(arrEqual([1], [])).toBe(false) // Different lengths
      expect(arrEqual([null], [null])).toBe(true) // Null values
      expect(arrEqual([undefined], [undefined])).toBe(true) // Undefined values
    })
  })
})
