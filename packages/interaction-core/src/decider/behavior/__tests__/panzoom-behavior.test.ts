import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SystemContextSnapshot } from '@asra/utils'
import { decidePanZoomBehavior } from '../panzoom-behavior'
import * as rules from '../../rules'
import { baseSnapshot } from '../../rules/__tests__/test-helpers'

vi.mock('../../rules', () => ({
  decidePanZoomRules: vi.fn()
}))

describe('decidePanZoomBehavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('should call decidePanZoomRules with the correct key and mouse snapshots', () => {
    const snapshot: SystemContextSnapshot = {
      ...baseSnapshot
    }
    decidePanZoomBehavior(snapshot)
    expect(rules.decidePanZoomRules).toHaveBeenCalledWith(
      snapshot.key,
      snapshot.mouse
    )
  })
})
