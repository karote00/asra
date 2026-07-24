import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getFeature: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  getFeature: mocks.getFeature
}))

import { FeatureNames } from '../../constants'
import { runGroupCommand } from '../group-command-actions'

describe('Group command controller handoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('routes visible controls through the registered feature API', () => {
    const result = {
      command: 'group' as const,
      groupId: 'group-created',
      selectedIds: ['group-created']
    }
    mocks.execute.mockReturnValue(result)
    mocks.getFeature.mockReturnValue({ execute: mocks.execute })

    expect(runGroupCommand('group')).toBe(result)
    expect(mocks.getFeature).toHaveBeenCalledWith(FeatureNames.GROUP_ELEMENTS)
    expect(mocks.execute).toHaveBeenCalledWith('group')
  })

  it('returns null without a fallback mutation when the feature is unavailable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.getFeature.mockImplementation(() => {
      throw new Error('feature unavailable')
    })

    expect(runGroupCommand('ungroup')).toBeNull()
    expect(mocks.execute).not.toHaveBeenCalled()
  })
})
