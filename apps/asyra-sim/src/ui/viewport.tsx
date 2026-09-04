import { useEffect, useRef } from 'react'
import type { SimRuntime } from '../init/bootstrap'
import type { SpatialCamera } from '../render-app/spatial-layer'
import type { Workcell } from '../domain/workcell'
import {
  createWorkcellFrame,
  DEFAULT_CAMERA
} from '../render-app/workcell-frame'

/** Camera navigation is transient UI state and never edits the experiment. */
export function useViewport(
  runtime: SimRuntime | null,
  workcell: Workcell | null,
  selectedId: string | null,
  camera: SpatialCamera,
  grid: boolean,
  isCurrent: (runtime: SimRuntime) => boolean,
  joints?: Readonly<Record<string, number>>
) {
  useEffect(() => {
    if (runtime && isCurrent(runtime))
      runtime.setFrame(
        workcell
          ? createWorkcellFrame(workcell, { selectedId, camera, grid, joints })
          : { camera, meshes: [] }
      )
  }, [runtime, workcell, selectedId, camera, grid, joints, isCurrent])
}

export function ViewportControls({
  host,
  runtime,
  camera,
  onCamera,
  onSelect,
  isCurrent
}: {
  host: HTMLDivElement | null
  runtime: SimRuntime | null
  camera: SpatialCamera
  onCamera: (camera: SpatialCamera) => void
  onSelect: (id: string | null) => void
  isCurrent: (runtime: SimRuntime) => boolean
}) {
  const current = useRef(camera)
  current.current = camera
  useEffect(() => {
    if (!host || !runtime) return
    let drag: {
      x: number
      y: number
      moved: boolean
      camera: SpatialCamera
      pointerId: number
    } | null = null
    const down = (event: PointerEvent) => {
      if (!isCurrent(runtime) || event.button !== 0) return
      drag = {
        x: event.clientX,
        y: event.clientY,
        moved: false,
        camera: current.current,
        pointerId: event.pointerId
      }
      host.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      if (!isCurrent(runtime) || !drag || drag.pointerId !== event.pointerId)
        return
      const dx = event.clientX - drag.x,
        dy = event.clientY - drag.y
      if (Math.hypot(dx, dy) < 4 && !drag.moved) return
      drag.moved = true
      const start = drag.camera,
        p = start.position.map((v, i) => v - start.target[i]),
        radius = Math.hypot(...p)
      const yaw = Math.atan2(p[0], p[2]) - dx * 0.006,
        polar = Math.max(
          0.08,
          Math.min(Math.PI - 0.08, Math.acos(p[1] / radius) + dy * 0.006)
        )
      onCamera({
        ...start,
        position: [
          start.target[0] + radius * Math.sin(polar) * Math.sin(yaw),
          start.target[1] + radius * Math.cos(polar),
          start.target[2] + radius * Math.sin(polar) * Math.cos(yaw)
        ]
      })
    }
    const up = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      if (isCurrent(runtime) && !drag.moved)
        onSelect(runtime.pick(event.clientX, event.clientY) ?? null)
      drag = null
      if (host.hasPointerCapture(event.pointerId))
        host.releasePointerCapture(event.pointerId)
    }
    const cancel = () => {
      drag = null
    }
    const wheel = (event: WheelEvent) => {
      if (!isCurrent(runtime)) return
      event.preventDefault()
      const c = current.current,
        p = c.position.map((v, i) => v - c.target[i]),
        radius = Math.hypot(...p),
        next = Math.max(
          0.15,
          Math.min(
            100,
            radius *
              Math.exp(Math.max(-100, Math.min(100, event.deltaY)) * 0.002)
          )
        )
      onCamera({
        ...c,
        position: c.target.map(
          (v, i) => v + (p[i] * next) / radius
        ) as unknown as SpatialCamera['position']
      })
    }
    host.addEventListener('pointerdown', down)
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerup', up)
    host.addEventListener('pointercancel', cancel)
    host.addEventListener('wheel', wheel, { passive: false })
    return () => {
      if (drag && host.hasPointerCapture(drag.pointerId))
        host.releasePointerCapture(drag.pointerId)
      drag = null
      host.removeEventListener('pointerdown', down)
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerup', up)
      host.removeEventListener('pointercancel', cancel)
      host.removeEventListener('wheel', wheel)
    }
  }, [host, runtime, onCamera, onSelect, isCurrent])
  return (
    <div className="viewport-tools">
      <button
        disabled={!runtime}
        onClick={() => {
          if (runtime && isCurrent(runtime))
            onCamera(structuredClone(DEFAULT_CAMERA))
        }}
      >
        Reset view
      </button>
      <span>Drag to orbit · Scroll to zoom · Click to select</span>
    </div>
  )
}
