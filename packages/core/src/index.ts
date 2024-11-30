type CoreProps = {
  version: string
}

type CoreDataType = Partial<CoreProps>

const DATA_VERSION = '1.0.0'

class Core {
  constructor(data: CoreDataType) {
    this._init(data)
  }

  _init(data: CoreDataType) {
    this.version = data.version ?? DATA_VERSION
  }
}

interface Core extends CoreProps {}

export default Core
