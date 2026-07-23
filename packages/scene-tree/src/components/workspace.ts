import type {
  EvnetOptions,
  WorkspaceRawData,
  ElementInstanceTypes,
  GroupInstanceTypes,
  IElement
} from '@asyra/utils'
import { IDTypes, NameTypes, EntityTypes, loadId, loadName } from '@asyra/utils'
import { isGroupEntity } from '../entity-data'
import Group from './group'
import type { ISceneTreeRegistry } from '../types'

type WorkspaceDataType = Partial<WorkspaceRawData>

class Workspace extends Group {
  private registry: ISceneTreeRegistry

  constructor(registry: ISceneTreeRegistry) {
    super({}, IDTypes.WORKSPACE, NameTypes.WORKSPACE)
    this.registry = registry
  }

  _init(): void {
    super._init()
    this.data.type = EntityTypes.WORKSPACE
  }

  load(data: WorkspaceDataType): void {
    super.load(data)
    if (data.id) {
      this.data.id = data.id
      loadId(data.id, IDTypes.WORKSPACE)
    }
    if (data.name) {
      this.data.name = data.name
      loadName(data.name, NameTypes.WORKSPACE)
    }
    if (typeof data.visible === 'boolean') {
      this.data.visible = data.visible
    }
    if (typeof data.lock === 'boolean') {
      this.data.lock = data.lock
    }
    this.data.parentId = typeof data.parentId === 'string' ? data.parentId : ''
  }

  get firstFrame(): ElementInstanceTypes | null {
    let result = null

    const children = this.get('children')
    for (const childId of children) {
      const child = this.registry.getElementById(childId)
      if (
        child &&
        isGroupEntity(child.get('type')) &&
        (child as GroupInstanceTypes).get('children')
      ) {
        result = child
        break
      }
    }

    return result
  }

  addNewElement(
    element: ElementInstanceTypes,
    parent?: GroupInstanceTypes,
    index = -1
  ) {
    if (!element) {
      return
    }

    let avaliableParent = parent
    if (!avaliableParent) {
      const firstFrame = this.firstFrame
      if (firstFrame) {
        avaliableParent = this.firstFrame as GroupInstanceTypes
      }
    }

    if (avaliableParent && avaliableParent.get('children')) {
      // Add new element to Group type instance
      avaliableParent.addElement(element, index)
    } else {
      // Add new element to Workspace
      super.addElement(element, index)
    }
    this.registry.addToMap(element)
  }

  removeElement(
    element: IElement,
    parent?: GroupInstanceTypes,
    options?: EvnetOptions
  ) {
    if (!element) {
      return
    }

    const elementId = element.get('id')
    if (parent && parent.get('children')) {
      // Remove element from Group type instance
      if (parent.get('children').indexOf(elementId) < 0) {
        return
      }
      parent.removeElement(element)
    } else {
      // Remove element from Workspace
      if (this.get('children').indexOf(elementId) < 0) {
        return
      }
      super.removeElement(element)
    }

    element.cleanup(options)

    // Remove element from Workspace
    this.registry.removeFromMap(element)
  }
}

export default Workspace
