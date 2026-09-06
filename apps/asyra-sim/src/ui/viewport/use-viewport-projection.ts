import { useEffect, useMemo, useRef } from 'react'
import type { Workcell } from '../../domain/workcell'
import type { SimRuntime } from '../../init/bootstrap'
import type { SpatialCamera } from '../../render-app/spatial-layer'
import {
  DEFAULT_CAMERA,
  prepareWorkcellProjection
} from '../../render-app/workcell-frame'
import type { PreparedVisualImport } from '../../storage/visual-archive'

export function useViewport(
  runtime: SimRuntime | null,
  workcell: Workcell | null,
  selectedId: string | null,
  camera: SpatialCamera,
  grid: boolean,
  isCurrent: (runtime: SimRuntime) => boolean,
  joints?: Readonly<Record<string, number>>,
  wireframe = false,
  pending?: PreparedVisualImport
) {
  const currentCamera = useRef(camera)

  currentCamera.current = camera

  const project = useMemo(
    () =>
      runtime && workcell && isCurrent(runtime)
        ? prepareWorkcellProjection(
            workcell,
            runtime.getVisualAssets(workcell, pending)
          )
        : null,
    [runtime, workcell, pending, isCurrent]
  )

  const frame = useMemo(
    () =>
      project?.({
        camera: DEFAULT_CAMERA,
        selectedId,
        grid,
        joints,
        wireframe
      }),
    [project, selectedId, grid, joints, wireframe]
  )

  useEffect(() => {
    if (runtime && isCurrent(runtime))
      runtime.setFrame({
        camera: currentCamera.current,
        meshes: frame?.meshes ?? []
      })
  }, [runtime, frame, isCurrent])

  useEffect(() => {
    if (runtime && isCurrent(runtime)) runtime.setCamera(camera)
  }, [runtime, camera, isCurrent])

  return frame?.meshes ?? []
}
