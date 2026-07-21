import type { SharedOperationEnvelope } from '@asyra/collaboration'
import { EventTypes } from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames
} from '@asyra/utils'
import { describe, expect, it, vi } from 'vitest'
import { createAsyraDesignOperationDefinitions } from '../../collaboration/operations'

const envelope = (
  channel: string,
  eventName: string,
  payload: unknown
): SharedOperationEnvelope => ({
  operationId: 'actor-a:session-a:1:forward',
  transactionId: '1',
  documentId: 'document-a',
  actorId: 'actor-a',
  protocolVersion: 1,
  schemaVersion: 1,
  origin: 'action',
  channel,
  eventName,
  payload
})

describe('Asyra Design collaboration document boundary', () => {
  it('registers only the supported Scene Tree and Props routes', () => {
    const definitions = createAsyraDesignOperationDefinitions(vi.fn())

    expect(
      definitions.map(({ channel, eventName }) => `${channel}/${eventName}`)
    ).toEqual([
      'sceneTree/addElement',
      'sceneTree/removeElement',
      'sceneTree/updateComputedData',
      'sceneTree/updateComputedDataPatch',
      'props/addProperty',
      'props/removeProperty',
      'props/updateProperty'
    ])
    definitions.forEach((definition) => {
      expect(definition.schemaVersion).toBe(1)
      expect(definition.validate(null)).toBe(false)
      expect(definition.validate({ eventName: definition.eventName })).toBe(
        false
      )
    })
  })

  it('accepts the app transaction payload shapes owned by each route', () => {
    const definitions = createAsyraDesignOperationDefinitions(vi.fn())
    const validPayloads = [
      {
        channel: SharedDataChannelNames.SCENE_TREE,
        eventName: EventTypes.ADD_ELEMENT,
        payload: {
          action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
          eventName: EventTypes.ADD_ELEMENT,
          data: { id: 'rect-a', type: 'rect' }
        }
      },
      {
        channel: SharedDataChannelNames.SCENE_TREE,
        eventName: EventTypes.REMOVE_ELEMENT,
        payload: {
          action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
          eventName: EventTypes.REMOVE_ELEMENT,
          data: { id: 'rect-a', type: 'rect' }
        }
      },
      {
        channel: SharedDataChannelNames.SCENE_TREE,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        payload: {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
          eventName: EventTypes.UPDATE_COMPUTED_DATA,
          id: 'rect-a',
          changes: [
            { owner: 'computed', key: 'x', before: 0, after: 10 },
            { owner: 'computed', key: 'y', before: 0, after: 20 }
          ]
        }
      },
      {
        channel: SharedDataChannelNames.SCENE_TREE,
        eventName: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
        payload: {
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
          eventName: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
          id: 'vector-a',
          patch: { values: { x: { before: 0, after: 10 } } }
        }
      },
      {
        channel: SharedDataChannelNames.PROPS,
        eventName: EventTypes.ADD_PROPERTY,
        payload: {
          action: PROPS_ACTIONS.ADD_PROPERTY,
          eventName: EventTypes.ADD_PROPERTY,
          data: [{ id: 'prop-a', type: 'position' }]
        }
      },
      {
        channel: SharedDataChannelNames.PROPS,
        eventName: EventTypes.REMOVE_PROPERTY,
        payload: {
          action: PROPS_ACTIONS.REMOVE_PROPERTY,
          eventName: EventTypes.REMOVE_PROPERTY,
          data: [{ id: 'prop-a', type: 'position' }]
        }
      },
      {
        channel: SharedDataChannelNames.PROPS,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: {
          action: PROPS_ACTIONS.UPDATE_PROPERTY,
          eventName: EventTypes.UPDATE_PROPERTY,
          id: 'prop-a',
          key: 'x',
          before: 0,
          after: 10
        }
      }
    ]

    validPayloads.forEach(({ channel, eventName, payload }) => {
      const definition = definitions.find(
        (candidate) =>
          candidate.channel === channel && candidate.eventName === eventName
      )
      expect(definition?.validate(payload)).toBe(true)
    })
  })

  it('forwards the validated payload unchanged to the canonical app processor exactly once', () => {
    const process = vi.fn(() => false)
    const definitions = createAsyraDesignOperationDefinitions(process)
    const definition = definitions.find(
      ({ channel, eventName }) =>
        channel === SharedDataChannelNames.SCENE_TREE &&
        eventName === EventTypes.UPDATE_COMPUTED_DATA
    )
    const payload = {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      id: 'rect-a',
      changes: [
        { owner: 'computed', key: 'x', before: 10, after: 35 },
        { owner: 'computed', key: 'y', before: 20, after: 48 }
      ]
    }

    const applied = definition?.apply?.(
      envelope(
        SharedDataChannelNames.SCENE_TREE,
        EventTypes.UPDATE_COMPUTED_DATA,
        payload
      )
    )

    expect(applied).toBe(false)
    expect(process).toHaveBeenCalledTimes(1)
    expect(process).toHaveBeenCalledWith({
      type: EventTypes.UPDATE_COMPUTED_DATA,
      payload
    })
  })
})
