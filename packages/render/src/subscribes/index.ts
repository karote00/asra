import { initSystemContext } from './system'
import { initSceneTreeDataContext } from './scene-tree'
import { initSelectionContext } from './selection'

export const initDataContexts = () => {
  initSystemContext()
  initSceneTreeDataContext()
  initSelectionContext()
}
