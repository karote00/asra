import { initSystemContext } from './system'
import { initSceneTreeDataContext } from './scene-tree'
import { initSelectionContext } from './selection'
import { initViewportContext } from './viewport'

export const initDataContexts = () => {
  initSystemContext()
  initSceneTreeDataContext()
  initSelectionContext()
  initViewportContext()
}
