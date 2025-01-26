import type { PropsRawData } from '@asra/utils'

type PropsDataType = Partial<PropsRawData> | undefined

class Props {
  constructor() {
    this._init()
  }

  _init(): void {
    // init
  }

  load(data: PropsDataType): void {
    // load data
  }
}

export default Props
