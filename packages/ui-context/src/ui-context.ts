import { BehaviorSubject } from 'rxjs'

class UIContext {
  flattenedElementIds: BehaviorSubject<string[]>

  constructor() {
    this.flattenedElementIds = new BehaviorSubject<string[]>([])
  }
}

const uiContext = new UIContext()
export default uiContext
export { UIContext }
