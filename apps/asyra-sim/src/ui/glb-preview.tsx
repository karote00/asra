import { useEffect, useRef, useState } from 'react'
import type { VisualAsset } from '../engine/glb/decode'
import { RestrictedGlbPreviewWorker } from '../engine/glb/preview-worker'

export function GlbPreview() {
  const worker = useRef<RestrictedGlbPreviewWorker | null>(null)
  const controller = useRef<AbortController | null>(null)
  const [asset, setAsset] = useState<VisualAsset | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(
    () => () => {
      controller.current?.abort()
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
    setAsset(null)
    try {
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
        {busy && (
          <button onClick={() => controller.current?.abort()}>
            Cancel preview
          </button>
        )}
      </div>
      {error && <p className="inline-error">{error}</p>}
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
