import type { SimRuntime } from '../../init/bootstrap'
import type {
  SpatialCamera,
  SpatialFrame
} from '../../render-app/spatial-layer'
import { DEFAULT_CAMERA } from '../../render-app/workcell-frame'
import { useViewportNavigation } from './use-viewport-navigation'

export function ViewportControls({
  host,
  runtime,
  camera,
  onCamera,
  onSelect,
  isCurrent,
  getFitMeshes
}: {
  host: HTMLDivElement | null
  runtime: SimRuntime | null
  camera: SpatialCamera
  onCamera: (camera: SpatialCamera) => void
  onSelect: (id: string | null) => void
  isCurrent: (runtime: SimRuntime) => boolean
  getFitMeshes: () => SpatialFrame['meshes']
}) {
  const { updateCamera, cancelDrag, fit } = useViewportNavigation({
    host,
    runtime,
    camera,
    onCamera,
    onSelect,
    isCurrent,
    getFitMeshes
  })

  return (
    <div
      className="viewport-tools absolute bottom-13 left-5 right-5 flex items-center
        gap-[14px] pointer-events-none [&_button]:pointer-events-auto
        [&_button]:bg-[#203644] [&_button]:border [&_button]:border-[#3a5260]
        [&_button]:text-[#bfd0d9] [&_button]:text-[10px] [&_>_span]:text-[10px]
        [&_>_span]:text-[#73909f] max-[1100px]:[&_>_span]:hidden"
    >
      <button
        disabled={!runtime}
        onClick={fit}
        aria-keyshortcuts="Meta+1 Control+1"
        title="Fit all (⌘1 / Ctrl+1)"
      >
        Fit all
      </button>

      <button
        disabled={!runtime}
        onClick={() => {
          if (runtime && isCurrent(runtime)) {
            cancelDrag.current?.()

            updateCamera(structuredClone(DEFAULT_CAMERA))
          }
        }}
      >
        Reset view
      </button>

      <span title="Orbit: left or middle drag. Pan: Shift + middle or left drag. Zoom: two-finger scroll, mouse wheel or pinch. Select: left click. Fit all: ⌘1 / Ctrl+1.">
        Shift + drag to pan - Scroll to zoom
      </span>
    </div>
  )
}
