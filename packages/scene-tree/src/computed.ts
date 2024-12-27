import { ComputedRawData } from '@asra/utils'

type ComputedDataType = Partial<ComputedRawData> | undefined

class Computed {
  constructor(data?: ComputedDataType) {
    this._init()
    this.load(data)
  }

  _init(): void {
    // init
  }

  load(data: ComputedDataType): void {
    // load
  }
}

export default Computed
