import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrimaryToolHandlers } from '../primary-tool'
import { InteractionActions, PrimaryToolType } from '@asra/utils'
import * as reactiveEvents from '@asra/reactive-events'

vi.mock('@asra/reactive-events', () => ({
  decideToSwitchPrimaryTool: vi.fn()
}))

describe('PrimaryToolHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call decideToSwitchPrimaryTool for INTERACTION_SWITCH_PRIMARY_TOOL', () => {
    const payload = { primaryTool: PrimaryToolType.RECTANGLE }

    PrimaryToolHandlers[InteractionActions.INTERACTION_SWITCH_PRIMARY_TOOL](
      payload
    )

    expect(reactiveEvents.decideToSwitchPrimaryTool).toHaveBeenCalledWith(
      payload.primaryTool
    )
  })
})
