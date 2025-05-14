import { sceneTreeStore, initSceneTreeDataSubscribe } from './scene-tree'
import { selectionStore, initSelectionDataSubscribe } from './selection'
import { initRenderDataSubscribe } from './render'
import { initSystemContextSubscribe } from './system-context'

export const initDataContexts = () => {
  initRenderDataSubscribe()
  initSceneTreeDataSubscribe()
  initSelectionDataSubscribe()
  initSystemContextSubscribe()
}

export { sceneTreeStore, selectionStore }
