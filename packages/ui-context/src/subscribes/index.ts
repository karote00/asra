import { sceneTreeStore, initSceneTreeDataContext } from './scene-tree'
import { selectionStore, initSelectionDataContext } from './selection'
import { initRenderDataContext } from './render'

export const initDataContexts = () => {
  initRenderDataContext()
  initSceneTreeDataContext()
  initSelectionDataContext()
}

export { sceneTreeStore, selectionStore }
