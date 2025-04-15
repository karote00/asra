import { sceneTreeStore, initSceneTreeDataContext } from './scene-tree'
import {
  selectionStore,
  initElementSelectionDataContext
} from './element-selection'
import { initRenderDataContext } from './render'

export const initDataContexts = () => {
  initRenderDataContext()
  initSceneTreeDataContext()
  initElementSelectionDataContext()
}

export { sceneTreeStore, selectionStore }
