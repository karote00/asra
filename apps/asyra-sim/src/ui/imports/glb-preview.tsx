import type { Workcell } from '../../domain/workcell'
import type { SimRuntime } from '../../init/bootstrap'
import { VisualPlacementFields } from '../objects/visual-placement-fields'
import { usePartImport } from './use-part-import'
import { VisualPreview } from './visual-preview'

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
  const {
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
  } = usePartImport({
    runtime,
    candidateId,
    workcell,
    onPreview,
    isCurrent,
    active
  })

  return (
    <details className="glb-preview">
      <summary>
        GLB original part <span>complete source geometry</span>
      </summary>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Static, self-contained local GLB only. No remote resources, textures,
        animation or simplified collision geometry. Every triangle is retained.
        Open or ambiguous meshes may be viewed but block formal solid analysis.
        No automatic hole filling; appearance is not a photometric match.
      </p>

      <div className="file-row flex items-center gap-2 my-3 mx-0">
        <label
          className="file-button inline-block cursor-pointer py-[7px] px-[10px] border
            border-sim-border rounded-[5px] text-[10px] [&_input]:hidden
            [&:focus-within]:[outline:2px_solid_var(--sim-focus)]"
        >
          Choose GLB
          <input
            aria-label="Choose original part GLB"
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

      {error && (
        <p
          className="inline-error text-sim-error-text bg-sim-error p-[11px] rounded-[5px]
            text-[11px] leading-[1.6] wrap-anywhere"
        >
          {error}
        </p>
      )}

      {notice && <p role="status">{notice}</p>}
      {prepared && asset && (
        <>
          <dl
            className="asset-summary grid grid-cols-[1fr_1fr] gap-3 m-0 [&_dt]:text-[9px]
              [&_dt]:text-sim-muted [&_dt]:mb-1 [&_dd]:m-0 [&_dd]:text-[11px]
              [&_dd]:font-[650]"
          >
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

            <div className="asset-digest col-span-full wrap-anywhere">
              <dt>SHA-256</dt>

              <dd>{asset.source.sha256}</dd>
            </div>
          </dl>

          {needsMemoryAcknowledgement && (
            <label className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
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

            <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
              Scale must be positive (0.000001–1000). It changes this actual
              part in both display and analysis, without scaling joint motion.
            </p>

            <button
              disabled={needsMemoryAcknowledgement && !memoryAcknowledged}
              onClick={showPlacement}
            >
              Preview placement in 3D
            </button>

            {previewed && (
              <button
                className="primary bg-sim-accent text-[#fff] border-sim-accent [&:hover]:bg-sim-accent-hover"
                onClick={() => void accept()}
              >
                Accept original part
              </button>
            )}
          </fieldset>
        </>
      )}
    </details>
  )
}
