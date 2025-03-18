import { BehaviorSubject } from 'rxjs'

class UIContext {
  flattenedElementIds: BehaviorSubject<string[]>
  elementSelection: BehaviorSubject<Set<string>>
  vertexSelection: BehaviorSubject<Set<string>>

  constructor() {
    this.flattenedElementIds = new BehaviorSubject<string[]>([])
    this.elementSelection = new BehaviorSubject<Set<string>>(new Set())
    this.vertexSelection = new BehaviorSubject<Set<string>>(new Set())
  }
}

const uiContext = new UIContext()
export default uiContext
export { UIContext }
