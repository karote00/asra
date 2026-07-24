import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createCurrentGroupCommandRequest: vi.fn(),
  defineFeature: vi.fn(
    (
      _name: string,
      _event: string,
      definition: { api?: Record<string, unknown> }
    ) => ({
      api: definition.api ?? {},
      dispose: vi.fn()
    })
  ),
  groupElements: vi.fn(),
  runTransaction: vi.fn((operation: () => unknown) => operation()),
  selectElements: vi.fn(),
  ungroupElement: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  defineFeature: mocks.defineFeature
}))

vi.mock('../../common-apis', () => ({
  hierarchyApis: {
    groupElements: mocks.groupElements,
    ungroupElement: mocks.ungroupElement
  },
  selectionApis: {
    selectElements: mocks.selectElements
  },
  transactionApis: {
    runTransaction: mocks.runTransaction
  }
}))

vi.mock('../../controllers/group-commands', () => ({
  createCurrentGroupCommandRequest: mocks.createCurrentGroupCommandRequest
}))

import { FeatureNames, InputSystemEvents } from '../../constants'
import {
  executeGroupCommandRequest,
  groupCommandFeatureDefinition
} from './index'

describe('Group and Ungroup feature transaction', () => {
  beforeEach(() => {
    mocks.createCurrentGroupCommandRequest.mockReset()
    mocks.groupElements.mockReset()
    mocks.runTransaction.mockReset()
    mocks.selectElements.mockReset()
    mocks.ungroupElement.mockReset()
    mocks.runTransaction.mockImplementation((operation: () => unknown) =>
      operation()
    )
  })

  it('registers one exclusive priority-100 execution feature', () => {
    expect(mocks.defineFeature).toHaveBeenCalledWith(
      FeatureNames.GROUP_ELEMENTS,
      InputSystemEvents.INPUT_SHORTCUT_GROUP,
      groupCommandFeatureDefinition
    )
    expect(groupCommandFeatureDefinition).toMatchObject({
      priority: 100,
      exclusive: true
    })
    expect(groupCommandFeatureDefinition.execution).toEqual(
      expect.any(Function)
    )
  })

  it('groups and selects only the created official Group in one transaction', () => {
    mocks.groupElements.mockReturnValue({
      groupId: 'group-created',
      elementIds: ['a', 'c'],
      bounds: { x: 10, y: 20, width: 80, height: 40 }
    })

    expect(
      executeGroupCommandRequest({
        command: 'group',
        elementIds: ['a', 'c']
      })
    ).toEqual({
      command: 'group',
      groupId: 'group-created',
      selectedIds: ['group-created']
    })
    expect(mocks.runTransaction).toHaveBeenCalledTimes(1)
    expect(mocks.groupElements).toHaveBeenCalledWith(['a', 'c'])
    expect(mocks.selectElements).toHaveBeenCalledWith(['group-created'])
  })

  it('ungroups normal and empty Groups with exact post-selection', () => {
    mocks.ungroupElement
      .mockReturnValueOnce({
        groupId: 'group-1',
        elementIds: ['a', 'b'],
        removed: true
      })
      .mockReturnValueOnce({
        groupId: 'group-empty',
        elementIds: [],
        removed: true
      })

    expect(
      executeGroupCommandRequest({
        command: 'ungroup',
        elementIds: ['group-1']
      })
    ).toEqual({
      command: 'ungroup',
      groupId: 'group-1',
      selectedIds: ['a', 'b']
    })
    expect(mocks.selectElements).toHaveBeenLastCalledWith(['a', 'b'])

    expect(
      executeGroupCommandRequest({
        command: 'ungroup',
        elementIds: ['group-empty']
      })
    ).toEqual({
      command: 'ungroup',
      groupId: 'group-empty',
      selectedIds: []
    })
    expect(mocks.selectElements).toHaveBeenLastCalledWith([])
    expect(mocks.runTransaction).toHaveBeenCalledTimes(2)
  })

  it('bypasses unavailable execution before opening a transaction', () => {
    mocks.createCurrentGroupCommandRequest.mockReturnValue(null)

    expect(
      groupCommandFeatureDefinition.execution?.({
        detail: { groupCommand: 'group' }
      } as never)
    ).toBeNull()
    expect(mocks.runTransaction).not.toHaveBeenCalled()
    expect(mocks.groupElements).not.toHaveBeenCalled()
    expect(mocks.selectElements).not.toHaveBeenCalled()
  })

  it('maps the registered shortcut snapshot to Group or Shift+Ungroup', () => {
    mocks.createCurrentGroupCommandRequest.mockReturnValue({
      command: 'ungroup',
      elementIds: ['group-1']
    })
    mocks.ungroupElement.mockReturnValue({
      groupId: 'group-1',
      elementIds: ['a'],
      removed: true
    })

    expect(
      groupCommandFeatureDefinition.execution?.({
        keyShift: true,
        detail: { groupShortcut: true, editableTarget: false }
      } as never)
    ).toEqual({
      command: 'ungroup',
      groupId: 'group-1',
      selectedIds: ['a']
    })
    expect(groupCommandFeatureDefinition.api.execute('ungroup')).toMatchObject({
      command: 'ungroup',
      selectedIds: ['a']
    })
    expect(mocks.runTransaction).toHaveBeenCalledTimes(2)
  })

  it('bypasses registered shortcuts from an editable target', () => {
    expect(
      groupCommandFeatureDefinition.execution?.({
        keyShift: false,
        detail: { groupShortcut: true, editableTarget: true }
      } as never)
    ).toBeNull()
    expect(mocks.createCurrentGroupCommandRequest).not.toHaveBeenCalled()
    expect(mocks.runTransaction).not.toHaveBeenCalled()
  })

  it('does not write selection when canonical Group mutation throws', () => {
    const failure = new Error('canonical rejection')
    mocks.groupElements.mockImplementation(() => {
      throw failure
    })

    expect(() =>
      executeGroupCommandRequest({
        command: 'group',
        elementIds: ['missing']
      })
    ).toThrow(failure)
    expect(mocks.runTransaction).toHaveBeenCalledTimes(1)
    expect(mocks.selectElements).not.toHaveBeenCalled()
  })
})
