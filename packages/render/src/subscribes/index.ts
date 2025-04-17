import { initSceneTreeDataContext } from './scene-tree'
import { initSystemContext } from './system'

export const initDataContexts = () => {
  initSceneTreeDataContext()
  initSystemContext()
}
