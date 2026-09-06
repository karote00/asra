import { useState } from 'react'
import type { Workcell } from '../../domain/workcell'
import type { SimRuntime } from '../../init/bootstrap'
import { DEFAULT_CAMERA } from '../../render-app/workcell-frame'
import type { PreparedVisualImport } from '../../storage/visual-archive'
import { useViewport } from './use-viewport-projection'
import { ViewportControls } from './viewport-controls'

/** High-frequency camera state is local to the viewport, not the workbench. */
export function Viewport({
  host,
  runtime,
  workcell,
  selectedId,
  grid,
  wireframe,
  joints,
  pending,
  onSelect,
  isCurrent
}: {
  host: HTMLDivElement | null
  runtime: SimRuntime | null
  workcell: Workcell | null
  selectedId: string | null
  grid: boolean
  wireframe: boolean
  joints?: Readonly<Record<string, number>>
  pending?: PreparedVisualImport
  onSelect: (id: string | null) => void
  isCurrent: (runtime: SimRuntime) => boolean
}) {
  const [camera, setCamera] = useState(() => structuredClone(DEFAULT_CAMERA))

  const meshes = useViewport(
    runtime,
    workcell,
    selectedId,
    camera,
    grid,
    isCurrent,
    joints,
    wireframe,
    pending
  )

  return (
    <ViewportControls
      host={host}
      runtime={runtime}
      camera={camera}
      onCamera={setCamera}
      onSelect={onSelect}
      isCurrent={isCurrent}
      getFitMeshes={() => meshes}
    />
  )
}
