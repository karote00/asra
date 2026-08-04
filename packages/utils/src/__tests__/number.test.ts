import { describe, it, expect } from 'vitest'
import { clampUnit, roundFloat } from '../number.js'

describe('Number Utilities - Precision Handling', () => {
  describe('roundFloat', () => {
    it('should handle design tool precision requirements', () => {
      // Demonstrates: How the design tool handles floating point precision
      // Critical for pixel-perfect positioning and sizing
      expect(roundFloat(3.14159)).toBe(3.14)
      expect(roundFloat(10.999)).toBe(11)
      expect(roundFloat(0.1 + 0.2)).toBe(0.3) // Fixes JavaScript floating point issues
    })

    it('should support custom decimal precision for different use cases', () => {
      // Demonstrates: Different precision needs in design tools
      expect(roundFloat(3.14159, 0)).toBe(3) // Integer positioning
      expect(roundFloat(3.14159, 1)).toBe(3.1) // Coarse precision
      expect(roundFloat(3.14159, 3)).toBe(3.142) // Fine precision for calculations
    })

    it('should handle edge cases that occur in design calculations', () => {
      // Demonstrates: Real-world edge cases in design tool math
      expect(roundFloat(0)).toBe(0)
      expect(roundFloat(-3.14159)).toBe(-3.14)
      expect(roundFloat(999.999)).toBe(1000)
    })
  })

  describe('clampUnit', () => {
    it('clamps values to the inclusive unit interval', () => {
      expect(clampUnit(-0.1)).toBe(0)
      expect(clampUnit(0.25)).toBe(0.25)
      expect(clampUnit(1.1)).toBe(1)
    })
  })
})
