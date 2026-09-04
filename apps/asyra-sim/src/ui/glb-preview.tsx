import { useEffect, useRef, useState } from 'react'
import type { VisualAsset } from '../engine/glb/decode'
import { RestrictedGlbPreviewWorker } from '../engine/glb/preview-worker'
import { GLB_LIMITS } from '../engine/glb/schema'

export function GlbPreview() {
  const worker = useRef<RestrictedGlbPreviewWorker | null>(null)
  const controller = useRef<AbortController | null>(null)
  const [asset, setAsset] = useState<VisualAsset | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(
    () => () => {
      controller.current?.abort()
      controller.current = null
      void worker.current?.dispose()
    },
    []
  )
  const preview = async (file: File) => {
    controller.current?.abort()
    const nextController = new AbortController()
    controller.current = nextController
    worker.current ??= new RestrictedGlbPreviewWorker()
    setBusy(true)
    setError('')
    setNotice('')
    setAsset(null)
    try {
      if (file.size < 1 || file.size > GLB_LIMITS.bytes)
        throw new Error('Choose a nonempty GLB file no larger than 16 MiB.')
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (nextController.signal.aborted) return
      const next = await worker.current.decode(bytes, nextController.signal)
      if (!nextController.signal.aborted) setAsset(next)
    } catch (reason) {
      if (!nextController.signal.aborted)
        setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (controller.current === nextController) setBusy(false)
    }
  }
  const cancel = () => {
    controller.current?.abort()
    controller.current = null
    setBusy(false)
    setNotice('Preview cancelled. No asset was accepted.')
  }
  return (
    <details className="glb-preview">
      <summary>
        GLB visual reference <span>not an analysis collider</span>
      </summary>
      <p className="hint">
        Restricted local preview only. It cannot execute content, fetch remote
        resources, or become collision geometry automatically.
      </p>
      <div className="file-row">
        <label className="file-button">
          Choose GLB
          <input
            aria-label="Choose visual GLB"
            type="file"
            accept=".glb,model/gltf-binary"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void preview(file)
              event.currentTarget.value = ''
            }}
          />
        </label>
        {busy && <button onClick={cancel}>Cancel preview</button>}
      </div>
      {error && <p className="inline-error">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {asset && (
        <dl className="asset-summary">
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
            <dt>Source unit</dt>
            <dd>meters</dd>
          </div>
          <div className="asset-digest">
            <dt>SHA-256</dt>
            <dd>{asset.source.sha256}</dd>
          </div>
        </dl>
      )}
    </details>
  )
}
