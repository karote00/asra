import { BehaviorSubject } from 'rxjs'
import { ComputedAttrs, MIXED_STRING, PrimaryToolType } from '@asra/utils'
import { isEqual } from 'lodash'
import { ElementProperties } from './types'

const generalKeysToCompare: (keyof ElementProperties)[] = [
  'x',
  'y',
  'width',
  'height',
  'rotation'
]

class UIContext {
  zoom: BehaviorSubject<number>
  flattenedElementIds: BehaviorSubject<string[]>
  elementSelection: BehaviorSubject<Set<string>>
  vertexSelection: BehaviorSubject<Set<string>>
  x: BehaviorSubject<ElementProperties['x']>
  y: BehaviorSubject<ElementProperties['y']>
  width: BehaviorSubject<ElementProperties['width']>
  height: BehaviorSubject<ElementProperties['height']>
  rotation: BehaviorSubject<ElementProperties['rotation']>
  //   fills: BehaviorSubject<ElementProperties['fills']>

  // System Context
  primaryTool: BehaviorSubject<PrimaryToolType>

  constructor() {
    this.zoom = new BehaviorSubject<number>(1)
    this.flattenedElementIds = new BehaviorSubject<string[]>([])
    this.elementSelection = new BehaviorSubject<Set<string>>(new Set())
    this.vertexSelection = new BehaviorSubject<Set<string>>(new Set())
    this.x = new BehaviorSubject<ElementProperties['x']>(0)
    this.y = new BehaviorSubject<ElementProperties['y']>(0)
    this.width = new BehaviorSubject<ElementProperties['width']>(0)
    this.height = new BehaviorSubject<ElementProperties['height']>(0)
    this.rotation = new BehaviorSubject<ElementProperties['rotation']>(0)
    // this.fills = new BehaviorSubject<ElementProperties['fills']>([])

    this.primaryTool = new BehaviorSubject<PrimaryToolType>(
      PrimaryToolType.SELECT
    )
  }

  updateElementSelection(selectedIds: Set<string>) {
    if (!isEqual(this.elementSelection.getValue(), selectedIds)) {
      this.elementSelection.next(selectedIds)
    }
  }

  updateVertexSelection(selectedIds: Set<string>) {
    if (!isEqual(this.vertexSelection.getValue(), selectedIds)) {
      this.vertexSelection.next(selectedIds)
    }
  }

  updateComputedProperty<K extends keyof ComputedAttrs>(
    key: K,
    data: ComputedAttrs[K][]
  ) {
    if (!data.length) {
      return
    }

    const compareKey = key as keyof ElementProperties
    if (generalKeysToCompare.includes(compareKey)) {
      const result = this.computedSharedProperty(
        data as ElementProperties[keyof ElementProperties][]
      )
      if (result !== this[compareKey].getValue()) {
        this[compareKey].next(result)
      }
    }
  }

  updateComputedProperties(allElementData: ComputedAttrs[]) {
    const result = this.computeSharedProperties(allElementData)

    generalKeysToCompare.forEach((key) => {
      if (result[key] !== this[key].getValue()) {
        this[key].next(result[key])
      }
    })
  }

  computedSharedProperty<K extends keyof ElementProperties>(
    data: ElementProperties[K][]
  ) {
    return compareValue(data)
  }

  computeSharedProperties(allElementData: ComputedAttrs[]): ElementProperties {
    const result = {} as ElementProperties

    result.x = compareValues(allElementData, 'x') as ElementProperties['x']
    result.y = compareValues(allElementData, 'y') as ElementProperties['y']
    result.width = compareValues(
      allElementData,
      'width'
    ) as ElementProperties['width']
    result.height = compareValues(
      allElementData,
      'height'
    ) as ElementProperties['height']
    result.rotation = compareValues(
      allElementData,
      'rotation'
    ) as ElementProperties['rotation']

    return result
  }

  updateZoom(newZoom: number) {
    this.zoom.next(newZoom)
  }

  updatePrimaryTool(tool: PrimaryToolType) {
    if (tool !== this.primaryTool.getValue()) {
      this.primaryTool.next(tool)
    }
  }
}

const uiContext = new UIContext()

export default uiContext
export { UIContext }

const compareValue = <K extends keyof ElementProperties>(
  allElementData: ElementProperties[K][]
) => {
  const firstValue = allElementData[0]
  let isMixed = false

  for (let i = 1; i < allElementData.length; i++) {
    if (allElementData[i] !== firstValue) {
      isMixed = true
      break
    }
  }

  return isMixed ? MIXED_STRING : firstValue
}

const compareValues = (
  allElementData: ComputedAttrs[],
  compareKey: keyof ComputedAttrs
) => {
  const firstValue = allElementData[0][compareKey]
  let isMixed = false

  for (let i = 1; i < allElementData.length; i++) {
    if (allElementData[i][compareKey] !== firstValue) {
      isMixed = true
      break
    }
  }

  return isMixed ? MIXED_STRING : firstValue
}
