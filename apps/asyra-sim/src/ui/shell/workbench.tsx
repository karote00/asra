import { WorkbenchProvider } from './workbench-context'
import { WorkbenchHeader } from './workbench-header'
import { WorkbenchToolbar } from './workbench-toolbar'
import { WorkbenchNotices } from './workbench-notices'
import { HierarchyPanel } from './hierarchy-panel'
import { ViewportPanel } from './viewport-panel'
import { InspectorPanel } from './inspector-panel'
import { WorkbenchRuns } from './workbench-runs'
import { WorkbenchStatus } from './workbench-status'

function WorkbenchLayout() {
  return (
    <div className="workbench h-[100dvh] min-h-135 flex flex-col overflow-hidden">
      <WorkbenchHeader />

      <WorkbenchToolbar />

      <WorkbenchNotices />

      <main
        className="work-area relative grid grid-cols-[265px_minmax(300px,_1fr)_360px]
          flex-1 min-h-0 max-[1100px]:grid-cols-[minmax(0,_1fr)_360px]
          max-[700px]:grid-cols-[minmax(0,_1fr)]
          max-[700px]:grid-rows-[minmax(220px,_0.85fr)_minmax(0,_1fr)]"
      >
        <HierarchyPanel />

        <ViewportPanel />

        <InspectorPanel />
      </main>

      <WorkbenchRuns />

      <WorkbenchStatus />
    </div>
  )
}

export function Workbench() {
  return (
    <WorkbenchProvider>
      <WorkbenchLayout />
    </WorkbenchProvider>
  )
}
