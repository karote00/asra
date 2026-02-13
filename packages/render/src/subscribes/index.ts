import { initSystemContext } from './system'
import { initSceneTreeDataContext } from './scene-tree'
import { initSelectionContext } from './selection'
import { initViewportContext } from './viewport'
import { initSystemProperties } from './system-properties'

export const initDataContexts = () => {
  initSystemContext()
  initSceneTreeDataContext()
  initSelectionContext()
  initViewportContext()
  initSystemProperties()
}
