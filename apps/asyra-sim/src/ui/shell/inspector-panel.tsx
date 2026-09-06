import type { ReactNode } from 'react'
import { ExperimentInspector } from './experiment-inspector'
import { ObjectInspector } from './object-inspector'
import { useWorkbenchField } from './workbench-context'

function InspectorVisibility({
  mode,
  children
}: {
  mode: 'object' | 'experiment'
  children: ReactNode
}) {
  const inspector = useWorkbenchField('inspector')

  return (
    <div
      className="inspector-content h-full [&[hidden]]:hidden"
      hidden={inspector !== mode}
    >
      {children}
    </div>
  )
}

export function InspectorPanel() {
  return (
    <aside
      className="properties-panel bg-sim-surface min-h-0 min-w-0 border-l
            border-l-sim-border overflow-hidden max-[700px]:border-l-0
            max-[700px]:border-t max-[700px]:border-t-sim-border"
    >
      <InspectorVisibility mode="experiment">
        <ExperimentInspector />
      </InspectorVisibility>

      <InspectorVisibility mode="object">
        <ObjectInspector />
      </InspectorVisibility>
    </aside>
  )
}
