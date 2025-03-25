import propsManager, { PropsManager } from '@asra/props-manager'
import { PropsComponentRawData } from '@asra/utils'

export default class ElementPropsManager {
  propsManager: PropsManager = propsManager

  init() {}

  load(data: PropsComponentRawData) {
    this.propsManager.load(data)
  }

  save() {
    return this.propsManager.save()
  }
}
