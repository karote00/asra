import { useCallback, useEffect, useRef } from 'react'
import type { SimRuntime } from '../../init/bootstrap'
import type {
  SpatialCamera,
  SpatialFrame
} from '../../render-app/spatial-layer'
import { isEditableKeyboardEvent } from '../shared/keyboard-input'
import { fitCameraToMeshes, panCamera, wheelCamera } from './viewport-camera'

export function useViewportNavigation({
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
  const current = useRef(camera)

  current.current = camera

  const updateCamera = useCallback(
    (next: SpatialCamera) => {
      // Wheel bursts can arrive before React commits the next props projection.
      current.current = next

      onCamera(next)
    },
    [onCamera]
  )

  const fitMeshes = useRef(getFitMeshes)

  fitMeshes.current = getFitMeshes

  const cancelDrag = useRef<(() => void) | null>(null)

  const fit = useCallback(() => {
    if (!host || !runtime || !isCurrent(runtime)) return

    cancelDrag.current?.()

    const { width, height } = host.getBoundingClientRect()

    updateCamera(
      fitCameraToMeshes(current.current, fitMeshes.current(), width, height)
    )
  }, [host, runtime, isCurrent, updateCamera])

  useEffect(() => {
    if (!host || !runtime) return

    let active = true

    let drag: {
      x: number
      y: number
      moved: boolean
      camera: SpatialCamera
      pointerId: number
      pan: boolean
      select: boolean
      height: number
    } | null = null

    const down = (event: PointerEvent) => {
      if (
        !active ||
        !isCurrent(runtime) ||
        drag ||
        (event.button !== 0 && event.button !== 1) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return
      // Keep left-button native focus/blur so unfinished Object fields commit.
      // Middle-button navigation must suppress browser autoscroll.
      if (event.button === 1) event.preventDefault()

      drag = {
        x: event.clientX,
        y: event.clientY,
        moved: false,
        camera: current.current,
        pointerId: event.pointerId,
        pan: event.shiftKey,
        select: event.button === 0 && !event.shiftKey,
        height: host.getBoundingClientRect().height
      }

      host.setPointerCapture(event.pointerId)
    }

    const move = (event: PointerEvent) => {
      if (
        !active ||
        !isCurrent(runtime) ||
        !drag ||
        drag.pointerId !== event.pointerId
      )
        return

      const dx = event.clientX - drag.x

      const dy = event.clientY - drag.y

      if (Math.hypot(dx, dy) < 4 && !drag.moved) return

      drag.moved = true

      if (drag.pan) {
        updateCamera(panCamera(drag.camera, dx, dy, drag.height))

        return
      }

      const start = drag.camera

      const p = start.position.map((v, i) => v - start.target[i])

      const radius = Math.hypot(...p)

      const yaw = Math.atan2(p[0], p[2]) - dx * 0.006

      const polar = Math.max(
        0.08,
        Math.min(Math.PI - 0.08, Math.acos(p[1] / radius) + dy * 0.006)
      )

      updateCamera({
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

      if (active && isCurrent(runtime) && !drag.moved && drag.select)
        onSelect(runtime.pick(event.clientX, event.clientY) ?? null)

      cancel()
    }

    const cancel = () => {
      const id = drag?.pointerId

      drag = null

      if (id !== undefined && host.hasPointerCapture(id))
        host.releasePointerCapture(id)
    }

    cancelDrag.current = cancel

    const cancelPointer = (event: PointerEvent) => {
      if (event.pointerId === drag?.pointerId) cancel()
    }

    const visibility = () => {
      if (document.hidden) cancel()
    }

    const key = (event: KeyboardEvent) => {
      if (
        !active ||
        !isCurrent(runtime) ||
        event.defaultPrevented ||
        event.isComposing ||
        event.code !== 'Digit1' ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey === event.ctrlKey ||
        isEditableKeyboardEvent(event)
      )
        return

      event.preventDefault()

      if (!event.repeat) fit()
    }

    const wheel = (event: WheelEvent) => {
      if (
        !active ||
        !isCurrent(runtime) ||
        event.defaultPrevented ||
        event.altKey ||
        event.metaKey
      )
        return

      event.preventDefault()

      if (drag) return

      const { height } = host.getBoundingClientRect()

      const next = wheelCamera(current.current, event, height)

      if (next !== current.current) updateCamera(next)
    }

    host.addEventListener('pointerdown', down)

    host.addEventListener('pointermove', move)

    host.addEventListener('pointerup', up)

    host.addEventListener('pointercancel', cancelPointer)

    host.addEventListener('lostpointercapture', cancelPointer)
    // Own canvas navigation before Framework bubble listeners prevent scrolling.
    host.addEventListener('wheel', wheel, { passive: false, capture: true })

    window.addEventListener('blur', cancel)

    document.addEventListener('visibilitychange', visibility)

    document.addEventListener('keydown', key)

    return () => {
      active = false

      cancel()

      cancelDrag.current = null

      host.removeEventListener('pointerdown', down)

      host.removeEventListener('pointermove', move)

      host.removeEventListener('pointerup', up)

      host.removeEventListener('pointercancel', cancelPointer)

      host.removeEventListener('lostpointercapture', cancelPointer)

      host.removeEventListener('wheel', wheel, { capture: true })

      window.removeEventListener('blur', cancel)

      document.removeEventListener('visibilitychange', visibility)

      document.removeEventListener('keydown', key)
    }
  }, [host, runtime, updateCamera, onSelect, isCurrent, fit])

  return { current, updateCamera, cancelDrag, fit }
}
