import { BehaviorSubject, Subscription } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import { BaseSelection, renderSelectionStore } from '@asyra/core'
import { SCENE_TREE_ACTIONS, type SelectionChange } from '@asyra/utils'
import { EventTypes, publishEvent } from '@asyra/reactive-events'
import { applyPreset } from '../preset'
import type { PresetDependencies } from '../types'
import {
  SelectionActions,
  SelectionChannels,
  SelectionEventNames
} from '../selection/channels'

const createDeps = (): PresetDependencies =>
  ({
    sceneTree: {
      getElementById: () => undefined,
      getAllElements: () => new Map(),
      currentWorkspace: undefined
    },
    systemContext: {
      getManagedProperty: () => undefined,
      getSystemContextSnapshot: () => ({
        primaryTool: 'select',
        mousePosition: { x: 0, y: 0 }
      })
    },
    render: {
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      getMousePosInWorkspace: () => ({ x: 0, y: 0 }),
      zoomTo: () => undefined,
      panTo: () => undefined
    }
  }) as unknown as PresetDependencies

describe('Preset Selection Subscriptions', () => {
  it('applies selection channel changes and removes deleted selection ids via observers', () => {
    const observers = new Map<string, { onChange: (change: unknown) => void }>()
    const selections = new Map<string, BaseSelection>()
    const systemPropertyMap = new Map<string, BehaviorSubject<unknown>>()

    applyPreset(
      {
        registerEvent: vi.fn((event: string | { eventName: string }) => ({
          eventName: typeof event === 'string' ? event : event.eventName,
          publish: vi.fn(),
          subscribe: () => new Subscription()
        })),
        registerDataChannelObserver: vi.fn((registration) => {
          observers.set(registration.name, registration)
        }),
        getPresetDependencies: createDeps,
        registerRenderLayer: vi.fn(),
        registerPropertySchema: vi.fn(),
        defineSelection: (type, selection) => {
          selections.set(type, selection)
        },
        getSelection: (type) => selections.get(type),
        defineUIProperty: vi.fn(),
        defineSystemProperty: <T>(key: string, defaultValue: T) => {
          const existing = systemPropertyMap.get(key)
          if (existing) {
            return existing as BehaviorSubject<T>
          }

          const state = new BehaviorSubject<T>(defaultValue)
          systemPropertyMap.set(key, state as BehaviorSubject<unknown>)
          return state
        },
        getSystemPropertyObservable: <T>(key: string) =>
          systemPropertyMap.get(key) as BehaviorSubject<T> | undefined,
        createRenderGradientFillStyle: () => null as never
      },
      createDeps()
    )

    const selectionRuntimeObserver = observers.get('preset.selection.runtime')
    expect(selectionRuntimeObserver).toBeDefined()
    selectionRuntimeObserver?.onChange({
      selectionType: SelectionChannels.ELEMENT,
      action: SelectionActions.SELECT_ELEMENTS,
      eventName: SelectionEventNames.SELECT_ELEMENTS,
      before: [],
      after: ['rect-1', 'oval-1']
    } satisfies SelectionChange)

    expect(
      Array.from(
        selections.get(SelectionChannels.ELEMENT)?.getSelectedIds() ?? []
      )
    ).toEqual(['rect-1', 'oval-1'])

    selectionRuntimeObserver?.onChange({
      selectionType: SelectionChannels.VECTOR_POINT,
      action: SelectionActions.SELECT_VECTOR_POINTS,
      eventName: SelectionEventNames.SELECT_VECTOR_POINTS,
      before: [],
      after: ['point-1']
    } satisfies SelectionChange)

    expect(
      Array.from(
        selections.get(SelectionChannels.VECTOR_POINT)?.getSelectedIds() ?? []
      )
    ).toEqual(['point-1'])

    selectionRuntimeObserver?.onChange({
      selectionType: SelectionChannels.VECTOR_SEGMENT,
      action: SelectionActions.SELECT_VECTOR_SEGMENTS,
      eventName: SelectionEventNames.SELECT_VECTOR_SEGMENTS,
      before: [],
      after: ['segment-1']
    } satisfies SelectionChange)

    expect(
      Array.from(
        selections.get(SelectionChannels.VECTOR_SEGMENT)?.getSelectedIds() ?? []
      )
    ).toEqual(['segment-1'])
    const sceneTreeObserver = observers.get('preset.uiContext.sceneTree')
    expect(sceneTreeObserver).toBeDefined()

    sceneTreeObserver?.onChange({
      action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
      data: { id: 'oval-1', type: 'oval' },
      parentId: 'workspace-1'
    })

    expect(
      Array.from(
        selections.get(SelectionChannels.ELEMENT)?.getSelectedIds() ?? []
      )
    ).toEqual(['rect-1'])

    const renderSelectionSpy = vi.spyOn(renderSelectionStore, 'updateSelection')

    // Undo/redo path publishes direct selection events (not shared-channel updates).
    // Ensure those events still refresh render selection mirrors.
    publishEvent({
      type: EventTypes.SELECT_ELEMENTS,
      payload: {
        selectionType: SelectionChannels.ELEMENT,
        action: SelectionActions.SELECT_ELEMENTS,
        eventName: SelectionEventNames.SELECT_ELEMENTS,
        before: ['rect-1'],
        after: ['rect-1', 'vector-1']
      }
    })

    expect(
      Array.from(
        selections.get(SelectionChannels.ELEMENT)?.getSelectedIds() ?? []
      )
    ).toEqual(['rect-1', 'vector-1'])
    expect(renderSelectionSpy).toHaveBeenCalledWith(SelectionChannels.ELEMENT)
  })
})
