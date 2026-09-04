import { useEffect, useRef, useState } from 'react'
import { IDENTITY_POSE } from '../domain/math'
import type { Workcell } from '../domain/workcell'
import type { VisualPlacement } from '../features/storage-visuals'
import type { SimRuntime } from '../init/bootstrap'
import type { PreparedVisualImport } from '../storage/visual-archive'
import { VISUAL_SOURCE_PROFILE } from '../storage/visual-source'
import { VisualPlacementFields } from './visual-placement-fields'

const VISUAL_MEMORY_WARNING_BYTES = 8 * 1024 * 1024

export interface VisualPreview {
  workcell: Workcell
  prepared: PreparedVisualImport
}

export function GlbPreview({
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
  const controller = useRef<AbortController | null>(null),
    receipt = useRef<PreparedVisualImport | null>(null)
  const live = useRef(true),
    current = useRef(isCurrent)
  current.current = isCurrent
  const [prepared, setPrepared] = useState<PreparedVisualImport | null>(null)
  const [targetId, setTargetId] = useState(workcell.bodies[0]?.id ?? '')
  const [placement, setPlacement] = useState<VisualPlacement>(() => ({
    version: 1,
    id: crypto.randomUUID(),
    pose: IDENTITY_POSE,
    scale: [1, 1, 1]
  }))
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('')
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
        'Visual reference accepted · one Undo action. Save the project to retain it locally.'
      )
    } catch (reason) {
      if (live.current && current.current(runtime))
        setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (live.current) setPhase(null)
    }
  }
  const asset = prepared?.asset
  return (
    <details className="glb-preview">
      <summary>
        GLB visual reference <span>not an analysis collider</span>
      </summary>
      <p className="hint">
        Static, self-contained local GLB only. No remote resources, textures,
        animation or automatic collision geometry. Asset transforms are baked;
        appearance is not a photometric match.
      </p>
      <div className="file-row">
        <label className="file-button">
          Choose GLB
          <input
            aria-label="Choose visual GLB"
            type="file"
            accept=".glb,model/gltf-binary"
            disabled={phase !== null}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void preview(file)
              event.currentTarget.value = ''
            }}
          />
        </label>
        {(phase || prepared) && (
          <button
            disabled={phase === 'accepting'}
            onClick={() => {
              releaseSource()
              setPhase(null)
              setError('')
              setNotice('Preview cancelled. No asset was accepted.')
            }}
          >
            Cancel preview
          </button>
        )}
      </div>
      {error && <p className="inline-error">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {prepared && asset && (
        <>
          <dl className="asset-summary">
            <div>
              <dt>Source</dt>
              <dd>{prepared.source.filename}</dd>
            </div>
            <div>
              <dt>Meshes</dt>
              <dd>{asset.meshes.length}</dd>
            </div>
            <div>
              <dt>Triangles</dt>
              <dd>
                {asset.meshes.reduce(
                  (total, mesh) => total + mesh.indices.length / 3,
                  0
                )}
              </dd>
            </div>
            <div>
              <dt>Dimensions (m)</dt>
              <dd>
                {asset.bounds.max
                  .map((value, index) =>
                    Number((value - asset.bounds.min[index]).toPrecision(6))
                  )
                  .join(' × ')}
              </dd>
            </div>
            <div>
              <dt>Source unit</dt>
              <dd>meters; verify against your source</dd>
            </div>
            <div className="asset-digest">
              <dt>SHA-256</dt>
              <dd>{asset.source.sha256}</dd>
            </div>
          </dl>
          {needsMemoryAcknowledgement && (
            <label className="hint">
              <input
                type="checkbox"
                aria-label="Visual memory warning acknowledgement"
                checked={memoryAcknowledged}
                onChange={(event) => {
                  invalidatePlacement()
                  setMemoryAcknowledged(event.target.checked)
                }}
              />
              I acknowledge this{' '}
              {(prepared.source.byteLength / (1024 * 1024)).toFixed(2)} MiB
              source exceeds the 8 MiB warning threshold. Expanded geometry and
              repeated instances consume additional memory. This does not
              override hard limits.
            </label>
          )}
          <label>
            Attach to body
            <select
              aria-label="Visual target body"
              value={targetId}
              disabled={phase !== null}
              onChange={(event) => {
                invalidatePlacement()
                setTargetId(event.target.value)
              }}
            >
              {!workcell.bodies.some((body) => body.id === targetId) && (
                <option value="">Choose a target</option>
              )}
              {workcell.bodies.map((body) => (
                <option key={body.id} value={body.id}>
                  {body.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset disabled={phase !== null}>
            <legend>Body-local placement</legend>
            <VisualPlacementFields
              value={placement}
              onChange={(value) => {
                invalidatePlacement()
                setPlacement({ ...placement, ...value })
              }}
            />
            <p className="hint">
              Scale must be positive (0.000001–1000). It affects only this
              visual, never joints or analysis shapes.
            </p>
            <button
              disabled={needsMemoryAcknowledgement && !memoryAcknowledged}
              onClick={showPlacement}
            >
              Preview placement in 3D
            </button>
            {previewed && (
              <button className="primary" onClick={() => void accept()}>
                Accept visual reference
              </button>
            )}
          </fieldset>
        </>
      )}
    </details>
  )
}
