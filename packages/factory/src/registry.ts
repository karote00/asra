import doc from './data'
import { SceneTreeChange } from './change-types'

const sceneTreeChangesMap = doc.getArray<SceneTreeChange>('sceneTreeChanges')

export { sceneTreeChangesMap }
