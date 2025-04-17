import { ComputedAttrs, ElementRawData } from '@asra/utils'

export type RenderElementData = Omit<ElementRawData, 'props'> & ComputedAttrs

export type RenderElementsData = Record<string, RenderElementData>

export interface RenderContainerData {
  id: string
  x: number
  y: number
}
