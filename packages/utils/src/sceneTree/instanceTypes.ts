import { EntityType } from './enum'
import type { ElementRawData, PropsRawData } from './rawDataTypes'
import { ISetter } from '../setter'
import { Style } from '../types'
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
  updateData(key: string, data: unknown): void
  cleanup(): void
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
  cleanup(): void
  getAllComputedData(): ComputedAttrs | {}
  updateComputedData<K extends keyof ComputedAttrs>(
    key: K,
    data: ComputedAttrs[K]
  ): void
}

export interface IGroupElement<T extends GroupAttrs = GroupAttrs>
  extends IElement<T> {
  addElement(element: ElementInstanceTypes, index?: number): void
  removeElement(element: ElementInstanceTypes, index: number): void
}

export interface ElementInstanceTypes extends IElement { }
export interface GroupInstanceTypes extends IGroupElement { }
export type ElementInstanceDataTypes = ComputedAttrs | GroupAttrs | ElementAttrs
