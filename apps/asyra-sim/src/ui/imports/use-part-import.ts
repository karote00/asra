import { useEffect, useRef, useState } from 'react'
import { IDENTITY_POSE } from '../../domain/math'
import type { Workcell } from '../../domain/workcell'
import type { VisualPlacement } from '../../features/storage-visuals'
import type { SimRuntime } from '../../init/bootstrap'
import type { PreparedVisualImport } from '../../storage/visual-archive'
import { VISUAL_SOURCE_PROFILE } from '../../storage/visual-source'
import type { VisualPreview } from './visual-preview'

const VISUAL_MEMORY_WARNING_BYTES = 8 * 1024 * 1024

export function usePartImport({
  runtime,
  candidateId,
  workcell,
  onPreview,
  isCurrent,
  active
}: {
  runtime: SimRuntime
  candidateId: string
  workcell: Workcell
  onPreview: (preview: VisualPreview | null) => void
  isCurrent: (runtime: SimRuntime) => boolean
  active: boolean
}) {
  const controller = useRef<AbortController | null>(null)

  const receipt = useRef<PreparedVisualImport | null>(null)

  const live = useRef(true)

  const current = useRef(isCurrent)

  current.current = isCurrent

  const [prepared, setPrepared] = useState<PreparedVisualImport | null>(null)

  const [targetId, setTargetId] = useState(workcell.bodies[0]?.id ?? '')

  const [placement, setPlacement] = useState<VisualPlacement>(() => ({
    version: 1,
    id: crypto.randomUUID(),
    pose: IDENTITY_POSE,
    scale: [1, 1, 1]
  }))

  const [error, setError] = useState('')

  const [notice, setNotice] = useState('')

  const [phase, setPhase] = useState<
    'reading' | 'preparing' | 'accepting' | null
  >(null)

  const [previewed, setPreviewed] = useState(false)

  const [memoryAcknowledged, setMemoryAcknowledged] = useState(false)

  const needsMemoryAcknowledgement =
    (prepared?.source.byteLength ?? 0) > VISUAL_MEMORY_WARNING_BYTES

  const workcellKey = JSON.stringify(workcell)

  const invalidatePlacement = () => {
    setPreviewed(false)

    onPreview(null)
  }

  const discard = (value: PreparedVisualImport) => {
    if (current.current(runtime)) runtime.features.visuals.discard(value)
  }

  const releaseSource = () => {
    controller.current?.abort()

    controller.current = null

    if (receipt.current) discard(receipt.current)

    receipt.current = null

    setPrepared(null)

    setMemoryAcknowledged(false)

    invalidatePlacement()
  }

  useEffect(() => {
    live.current = true

    return () => {
      live.current = false

      controller.current?.abort()

      if (receipt.current && current.current(runtime))
        runtime.features.visuals.discard(receipt.current)

      receipt.current = null

      onPreview(null)
    }
  }, [runtime, onPreview])

  useEffect(() => {
    setPreviewed(false)

    onPreview(null)
  }, [workcellKey, onPreview])

  useEffect(() => {
    if (!active) {
      releaseSource()

      setPhase(null)
    }
  }, [active])

  const preview = async (file: File) => {
    releaseSource()

    const next = new AbortController()

    controller.current = next

    setPhase('reading')

    setError('')

    setNotice('')

    try {
      if (file.size < 1 || file.size > VISUAL_SOURCE_PROFILE.maxBytes)
        throw new Error('Choose a nonempty GLB file no larger than 16 MiB.')

      const bytes = new Uint8Array(await file.arrayBuffer())

      if (next.signal.aborted || !live.current || !current.current(runtime))
        return

      setPhase('preparing')

      const value = await runtime.features.visuals.prepare(bytes, file.name, {
        signal: next.signal
      })

      if (next.signal.aborted || !live.current || !current.current(runtime)) {
        discard(value)

        return
      }

      receipt.current = value

      setPrepared(value)

      setPlacement({
        version: 1,
        id: crypto.randomUUID(),
        pose: IDENTITY_POSE,
        scale: [1, 1, 1]
      })
    } catch (reason) {
      if (!next.signal.aborted && live.current && current.current(runtime))
        setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (controller.current === next && live.current) setPhase(null)
    }
  }

  const showPlacement = () => {
    if (!prepared || !current.current(runtime)) return

    if (needsMemoryAcknowledgement && !memoryAcknowledged) return

    try {
      if (!workcell.bodies.some((body) => body.id === targetId))
        throw new Error('Choose an available target body')

      const derived: Workcell = {
        ...workcell,
        bodies: workcell.bodies.map((body) =>
          body.id === targetId
            ? {
                ...body,
                visuals: [
                  ...(body.visuals ?? []),
                  { ...placement, assetId: prepared.source.assetId }
                ]
              }
            : body
        )
      }

      runtime.getVisualAssets(derived, prepared)

      onPreview({ workcell: derived, prepared })

      setPreviewed(true)

      setError('')
    } catch (reason) {
      invalidatePlacement()

      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const accept = async () => {
    if (!prepared || !previewed || !current.current(runtime)) return

    if (needsMemoryAcknowledgement && !memoryAcknowledged) return

    setPhase('accepting')

    invalidatePlacement()

    try {
      await runtime.features.visuals.retain(
        prepared,
        candidateId,
        targetId,
        placement
      )

      if (!live.current || !current.current(runtime)) return

      releaseSource()

      setError('')

      setNotice(
        'Original part accepted - one Undo action. Save the project to retain it locally.'
      )
    } catch (reason) {
      if (live.current && current.current(runtime))
        setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (live.current) setPhase(null)
    }
  }

  const asset = prepared?.asset

  return {
    prepared,
    targetId,
    setTargetId,
    placement,
    setPlacement,
    error,
    setError,
    notice,
    setNotice,
    phase,
    setPhase,
    previewed,
    memoryAcknowledged,
    setMemoryAcknowledged,
    needsMemoryAcknowledgement,
    invalidatePlacement,
    releaseSource,
    preview,
    showPlacement,
    accept,
    asset
  }
}
