import { ElementRawData } from '@asra/utils'
import { ACTIONS } from './enum'

export interface SceneTreeChange {
  action: ACTIONS
  parentId: string
  index: number
  data: ElementRawData
}
