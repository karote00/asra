type WorkspaceData = {}

type WorkspaceDataType = Partial<WorkspaceData>

class Workspace {
  constructor(data: WorkspaceDataType) {
    this._init(data)
  }

  _init(data: WorkspaceDataType) {}
}

interface Workspace extends WorkspaceData {}

export default Workspace
