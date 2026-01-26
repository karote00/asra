import type { FrameRawData } from '@asyra/utils'
import { EntityTypes, NameTypes } from '@asyra/utils'
import Group from './group'

type FrameDataType = Partial<FrameRawData>

class Frame extends Group {
  constructor(data?: Partial<FrameRawData>) {
    super(data)
  }

  _init(): void {
    this._nameType = NameTypes.FRAME
    super._init()
    this.data.type = EntityTypes.FRAME
  }

  create(): void {
    super.create()
    this.data.type = EntityTypes.FRAME
  }

  load(data: FrameDataType): void {
    super.load(data)
  }
}

export default Frame
