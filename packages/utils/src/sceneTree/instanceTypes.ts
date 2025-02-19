import { EntityTypes } from './enum'
import type { ElementRawData } from './rawDataTypes'

export interface ISetter<T extends ElementAttrs = ElementAttrs> {
  get<K extends keyof T>(key: K): T[K]
  set<K extends keyof T>(key: K, value: T[K]): void
}

export interface ElementAttrs {
  id: string
  type: EntityTypes
  name: string
  visible: boolean
  lock: boolean
}

export interface GroupAttrs extends ElementAttrs {
  children: string[]
}

export interface IElement<T extends ElementAttrs = ElementAttrs>
  extends ISetter<T> {
  load(data: Partial<ElementRawData>): void
  save(): ElementRawData
}

export interface IGroupElement<T extends GroupAttrs = GroupAttrs>
  extends IElement<T> {
  addElement(element: ElementInstanceTypes, index?: number): void
  removeElement(element: ElementInstanceTypes, index: number): void
}

export interface ElementInstanceTypes extends IElement {}
export interface GroupInstanceTypes extends IGroupElement {}
