import { ElementRawData, OWNER } from '@asra/utils'
import { ACTIONS } from './enum'

export interface SceneTreeChange {
  owner: OWNER
  action: ACTIONS
  parentId: string
  index: number
  data: ElementRawData
}
