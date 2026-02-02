import { sceneTreeStore, initSceneTreeDataSubscribe } from './scene-tree'
import { selectionStore, initSelectionDataSubscribe } from './selection'
import { initRenderDataSubscribe } from './render'

export const initDataContexts = () => {
  initRenderDataSubscribe()
  initSceneTreeDataSubscribe()
  initSelectionDataSubscribe()
}

export { sceneTreeStore, selectionStore }
