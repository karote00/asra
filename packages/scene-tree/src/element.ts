import { ElementRawData, EntityTypes } from '@asra/utils'
import Props from './props'
import Computed from './computed'

type ElementDataType = Partial<ElementRawData>

class Element {
  id: string = ''
  name: string = ''
  type: EntityTypes = EntityTypes.UNDEFINED
  props: Props = new Props()
  computed: Computed = new Computed()

  constructor() {
    this._init()
  }

  _init(): void {}

  load(data: ElementDataType): void {
    if (!data) {
      return
    }

    this.type = data.type!
    this.props.load(data.props)
  }
}

export default Element
