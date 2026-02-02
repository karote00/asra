import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UIContext } from '../ui-context'
import { BehaviorSubject } from 'rxjs'
import {
  ComputedAttrs,
  MIXED_STRING,
  EntityTypes
} from '@asyra/utils'

describe('UIContext', () => {
  let uiContext: UIContext

  beforeEach(() => {
    vi.clearAllMocks()

    uiContext = new UIContext()
  })

  // Test constructor
  it('should initialize all BehaviorSubjects with correct default values', () => {
    expect(uiContext.zoom).toBeInstanceOf(BehaviorSubject)
    expect(uiContext.zoom.getValue()).toBe(1)
    expect(uiContext.flattenedElementIds).toBeInstanceOf(BehaviorSubject)
    expect(uiContext.flattenedElementIds.getValue()).toEqual([])
    expect(uiContext.elementSelection).toBeInstanceOf(BehaviorSubject)
    expect(uiContext.elementSelection.getValue()).toEqual(new Set())
    expect(uiContext.vertexSelection).toBeInstanceOf(BehaviorSubject)
    expect(uiContext.vertexSelection.getValue()).toEqual(new Set())
    expect(uiContext.x).toBeInstanceOf(BehaviorSubject)
    expect(uiContext.x.getValue()).toBe(0)
    expect(uiContext.y).toBeInstanceOf(BehaviorSubject)
    expect(uiContext.y.getValue()).toBe(0)
    expect(uiContext.width).toBeInstanceOf(BehaviorSubject)
    expect(uiContext.width.getValue()).toBe(0)
    expect(uiContext.height).toBeInstanceOf(BehaviorSubject)
    expect(uiContext.height.getValue()).toBe(0)
    expect(uiContext.rotation).toBeInstanceOf(BehaviorSubject)
    expect(uiContext.rotation.getValue()).toBe(0)
    expect(uiContext.primaryTool).toBeInstanceOf(BehaviorSubject)
    expect(uiContext.primaryTool.getValue()).toBe(PrimaryToolType.SELECT)
  })

  // Test updateElementSelection
  it('should update elementSelection when selectedIds are different', () => {
    const newSelection = new Set(['id1', 'id2'])
    const nextSpy = vi.spyOn(uiContext.elementSelection, 'next')

    uiContext.updateElementSelection(newSelection)

    expect(nextSpy).toHaveBeenCalledWith(newSelection)
  })

  it('should not update elementSelection when selectedIds are the same', () => {
    const currentSelection = new Set(['id1'])
    uiContext.elementSelection.next(currentSelection)
    const nextSpy = vi.spyOn(uiContext.elementSelection, 'next')

    uiContext.updateElementSelection(currentSelection)

    expect(nextSpy).not.toHaveBeenCalled()
  })

  // Test updateVertexSelection
  it('should update vertexSelection when selectedIds are different', () => {
    const newSelection = new Set(['v1', 'v2'])
    const nextSpy = vi.spyOn(uiContext.vertexSelection, 'next')

    uiContext.updateVertexSelection(newSelection)

    expect(nextSpy).toHaveBeenCalledWith(newSelection)
  })

  it('should not update vertexSelection when selectedIds are the same', () => {
    const currentSelection = new Set(['v1'])
    uiContext.vertexSelection.next(currentSelection)
    const nextSpy = vi.spyOn(uiContext.vertexSelection, 'next')

    uiContext.updateVertexSelection(currentSelection)

    expect(nextSpy).not.toHaveBeenCalled()
  })

  // Test updateComputedProperty
  it('should update computed property with consistent value', () => {
    const nextSpy = vi.spyOn(uiContext.x, 'next')

    uiContext.updateComputedProperty('x', [10, 10])

    expect(nextSpy).toHaveBeenCalledWith(10)
  })

  it('should update computed property with MIXED_STRING for mixed values', () => {
    const nextSpy = vi.spyOn(uiContext.width, 'next')

    uiContext.updateComputedProperty('width', [100, 200])

    expect(nextSpy).toHaveBeenCalledWith(MIXED_STRING)
  })

  it('should not update computed property if value is the same', () => {
    uiContext.y.next(50)
    const nextSpy = vi.spyOn(uiContext.y, 'next')

    uiContext.updateComputedProperty('y', [50, 50])

    expect(nextSpy).not.toHaveBeenCalled()
  })

  it('should not update properties not in generalKeysToCompare', () => {
    const nextSpy = vi.spyOn(uiContext.flattenedElementIds, 'next')

    // Attempt to update a property not in generalKeysToCompare
    uiContext.updateComputedProperty(
      'flattenedElementIds' as unknown as keyof ComputedAttrs,
      [
        ['id1'] as unknown as ComputedAttrs[keyof ComputedAttrs],
        ['id2'] as unknown as ComputedAttrs[keyof ComputedAttrs]
      ]
    )

    expect(nextSpy).not.toHaveBeenCalled()
  })

  // Test updateComputedProperties
  it('should update all general properties with consistent values', () => {
    const allElementData: ComputedAttrs[] = [
      {
        id: '1',
        type: EntityTypes.RECTANGLE,
        name: 'rect 1',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 45
      },
      {
        id: '2',
        type: EntityTypes.RECTANGLE,
        name: 'rect 2',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 45
      }
    ]
    const xSpy = vi.spyOn(uiContext.x, 'next')
    const ySpy = vi.spyOn(uiContext.y, 'next')
    const widthSpy = vi.spyOn(uiContext.width, 'next')
    const heightSpy = vi.spyOn(uiContext.height, 'next')
    const rotationSpy = vi.spyOn(uiContext.rotation, 'next')

    uiContext.updateComputedProperties(allElementData)

    expect(xSpy).toHaveBeenCalledWith(10)
    expect(ySpy).toHaveBeenCalledWith(20)
    expect(widthSpy).toHaveBeenCalledWith(100)
    expect(heightSpy).toHaveBeenCalledWith(50)
    expect(rotationSpy).toHaveBeenCalledWith(45)
  })

  it('should update all general properties with MIXED_STRING for mixed values', () => {
    const allElementData: ComputedAttrs[] = [
      {
        id: '1',
        type: EntityTypes.RECTANGLE,
        name: 'rect 1',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 0
      },
      {
        id: '2',
        type: EntityTypes.RECTANGLE,
        name: 'rect 2',
        x: 15,
        y: 20,
        width: 100,
        height: 50,
        rotation: 0
      }
    ]
    const xSpy = vi.spyOn(uiContext.x, 'next')

    uiContext.updateComputedProperties(allElementData)

    expect(xSpy).toHaveBeenCalledWith(MIXED_STRING)
  })

  // Test updateZoom
  it('should update zoom value', () => {
    const nextSpy = vi.spyOn(uiContext.zoom, 'next')

    uiContext.updateZoom(2)

    expect(nextSpy).toHaveBeenCalledWith(2)
  })

  // Test updatePrimaryTool
  it('should update primaryTool when tool is different', () => {
    const nextSpy = vi.spyOn(uiContext.primaryTool, 'next')

    uiContext.updatePrimaryTool(PrimaryToolType.RECTANGLE)

    expect(nextSpy).toHaveBeenCalledWith(PrimaryToolType.RECTANGLE)
  })

  it('should not update primaryTool when tool is the same', () => {
    uiContext.primaryTool.next(PrimaryToolType.SELECT)
    const nextSpy = vi.spyOn(uiContext.primaryTool, 'next')

    uiContext.updatePrimaryTool(PrimaryToolType.SELECT)

    expect(nextSpy).not.toHaveBeenCalled()
  })
})
