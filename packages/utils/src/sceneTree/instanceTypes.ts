import { EntityType } from './enum'
import type { ElementRawData, PropsRawData } from './rawDataTypes'
import { ISetter } from '../setter'
import { Style } from '../types'
import type { EvnetOptions } from '../types/change'
// import { FillAttrs } from '../propsManager'

export interface ComputedAttrs extends Style {
  id: string
  type: EntityType
  name: string
  rotation: number
  // fills: FillAttrs[]
}

export interface ElementAttrs {
  id: string
  type: EntityType
  name: string
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
  set<K extends keyof T>(key: K, data: T[K], options?: EvnetOptions): void
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
    data: ComputedAttrs[K],
    options?: EvnetOptions
  ): void
}

export interface IGroupElement<T extends GroupAttrs = GroupAttrs>
  extends IElement<T> {
  addElement(element: ElementInstanceTypes, index?: number): void
  removeElement(element: ElementInstanceTypes, index: number): void
}

export interface ElementInstanceTypes extends IElement {}
export interface GroupInstanceTypes extends IGroupElement {}
export type ElementInstanceDataTypes = ComputedAttrs | GroupAttrs | ElementAttrs
