import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decideZoomFitBehavior } from '../zoomfit-behavior'
import * as rules from '../../rules'

vi.mock('../../rules', () => ({
  decideZoomFitRules: vi.fn()
}))

describe('decideZoomFitBehavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('should call decideZoomFitRules', () => {
    decideZoomFitBehavior()
    expect(rules.decideZoomFitRules).toHaveBeenCalled()
  })
})
