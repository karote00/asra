import { EntityType } from './enum.js'
import type { ElementRawData, PropsRawData } from './rawDataTypes.js'
import { ISetter } from '../setter.js'
import { Style } from '../types/index.js'
import type { EvnetOptions } from '../types/change.js'
import { FillAttrs, StrokeAttrs } from '../propsManager/index.js'

export interface ComputedAttrs extends Style {
  id: string
  type: EntityType
  name: string
  rotation: number
  fills: FillAttrs[]
  strokes: StrokeAttrs[]
}

export interface ElementAttrs {
  id: string
  type: EntityType
  name: string
  parentId: string
  visible: boolean
  lock: boolean
}

export interface GroupAttrs extends ElementAttrs {
  children: string[]
}

export interface IProps {
  elementId: string
  load(data?: Partial<PropsRawData>): void
  save(): PropsRawData
  updateData(key: string, data: unknown, options?: EvnetOptions): void
  cleanup(options?: EvnetOptions): void
  getPropId(name: string): string | undefined
}

export interface IComputed<T extends ComputedAttrs> extends ISetter<T> {
  set<K extends keyof T>(key: K, data: T[K]): void
}

export interface IElement<T extends ElementAttrs = ElementAttrs>
  extends ISetter<T> {
  props: IProps
  computed: IComputed<ComputedAttrs>
  load(data: Partial<ElementRawData>): void
  save(): ElementRawData
  cleanup(options?: EvnetOptions): void
  getAllComputedData(): ComputedAttrs | {}
  updateComputedData<K extends keyof ComputedAttrs>(
    key: K,
    data: ComputedAttrs[K]
  ): void
}

export interface IGroupElement<T extends GroupAttrs = GroupAttrs>
  extends IElement<T> {
  addElement(element: ElementInstanceTypes, index?: number): void
  removeElement(element: ElementInstanceTypes): void
}

export interface ElementInstanceTypes extends IElement {}
export interface GroupInstanceTypes extends IGroupElement {}
export type ElementInstanceDataTypes = ComputedAttrs | GroupAttrs | ElementAttrs
