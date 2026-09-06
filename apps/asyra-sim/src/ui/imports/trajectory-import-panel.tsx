import type { NormalizedTrajectorySource } from '../../domain/trajectory-source'
import type { Trajectory, Workcell } from '../../domain/workcell'
import { useTrajectoryImport } from './use-trajectory-import'

export function TrajectoryImportPanel({
  workcell,
  trajectory,
  onAccept
}: {
  workcell: Workcell
  trajectory: Trajectory
  onAccept: (value: NormalizedTrajectorySource) => void
}) {
  const {
    kind,
    text,
    setText,
    mapping,
    setMapping,
    preview,
    setPreview,
    columns,
    error,
    setError,
    reading,
    setReading,
    generation,
    actuated,
    inspect,
    load,
    setJointMapping
  } = useTrajectoryImport({ workcell, trajectory })

  return (
    <details className="trajectory-import">
      <summary>
        Trajectory input <span>preview before acceptance</span>
      </summary>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        CSV units are mapped explicitly. JSON must use the strict
        <code> sim-trajectory v1</code> envelope. Preview never edits the
        project.
      </p>

      <div className="file-row flex items-center gap-2 my-3 mx-0">
        <label
          className="file-button inline-block cursor-pointer py-[7px] px-[10px] border
            border-sim-border rounded-[5px] text-[10px] [&_input]:hidden
            [&:focus-within]:[outline:2px_solid_var(--sim-focus)]"
        >
          Load CSV
          <input
            aria-label="Load trajectory CSV"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0]

              if (file) void load(file, 'csv')

              event.currentTarget.value = ''
            }}
          />
        </label>

        <label
          className="file-button inline-block cursor-pointer py-[7px] px-[10px] border
            border-sim-border rounded-[5px] text-[10px] [&_input]:hidden
            [&:focus-within]:[outline:2px_solid_var(--sim-focus)]"
        >
          Load JSON
          <input
            aria-label="Load trajectory JSON"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0]

              if (file) void load(file, 'json')

              event.currentTarget.value = ''
            }}
          />
        </label>

        <span className="format-tag text-[9px] text-sim-muted ml-auto">
          {kind.toUpperCase()}
        </span>
      </div>

      {error && (
        <p
          className="inline-error text-sim-error-text bg-sim-error p-[11px] rounded-[5px]
            text-[11px] leading-[1.6] wrap-anywhere"
          role="alert"
        >
          {error}
        </p>
      )}

      <label>
        Source data
        <textarea
          aria-label="Trajectory source data"
          rows={7}
          value={text}
          spellCheck={false}
          onChange={(event) => {
            generation.current++

            setReading(false)

            setError('')

            setText(event.target.value)

            setPreview(null)
          }}
        />
      </label>

      {kind === 'csv' && (
        <div className="mapping-grid grid grid-cols-[1fr_1fr] gap-[10px] mb-3 [&_select]:text-[10px]">
          <label>
            Time column
            <select
              value={mapping.time.column}
              onChange={(event) =>
                setMapping((current) => ({
                  ...current,
                  time: { ...current.time, column: event.target.value }
                }))
              }
            >
              <option value="">Choose column</option>

              {columns.map((column) => (
                <option key={column}>{column}</option>
              ))}
            </select>
          </label>

          <label>
            Time unit
            <select
              value={mapping.time.unit}
              onChange={(event) =>
                setMapping((current) => ({
                  ...current,
                  time: {
                    ...current.time,
                    unit: event.target.value as 'ms' | 's'
                  }
                }))
              }
            >
              <option value="s">seconds</option>

              <option value="ms">milliseconds</option>
            </select>
          </label>

          {actuated.map((body) => {
            const entry = mapping.joints[body.id] ?? {
              column: '',
              unit: body.joint.kind === 'revolute' ? 'rad' : 'm'
            }

            return (
              <div
                className="mapping-row col-span-full grid grid-cols-[1fr_1fr] gap-[10px]"
                key={body.id}
              >
                <label>
                  {body.name}
                  <select
                    aria-label={`${body.name} CSV column`}
                    value={entry.column}
                    onChange={(event) =>
                      setJointMapping(body.id, {
                        ...entry,
                        column: event.target.value
                      })
                    }
                  >
                    <option value="">Choose column</option>

                    {columns.map((column) => (
                      <option key={column}>{column}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Unit
                  <select
                    aria-label={`${body.name} CSV unit`}
                    value={entry.unit}
                    onChange={(event) =>
                      setJointMapping(body.id, {
                        ...entry,
                        unit: event.target.value as typeof entry.unit
                      })
                    }
                  >
                    {body.joint.kind === 'revolute' ? (
                      <>
                        <option value="rad">radians</option>

                        <option value="deg">degrees</option>
                      </>
                    ) : (
                      <>
                        <option value="m">meters</option>

                        <option value="mm">millimeters</option>
                      </>
                    )}
                  </select>
                </label>
              </div>
            )
          })}
        </div>
      )}

      {reading && (
        <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
          Reading trajectory file…
        </p>
      )}

      <button
        className="wide w-full"
        disabled={reading}
        onClick={() => inspect()}
      >
        Preview trajectory
      </button>

      {preview && preview.diagnostics.length > 0 && (
        <ul
          className="diagnostic-list text-[11px] leading-[1.7] pl-[18px] text-sim-error-text"
          role="alert"
        >
          {preview.diagnostics.slice(0, 20).map((item, index) => (
            <li key={`${item.code}:${item.row ?? 0}:${index}`}>
              {item.row ? `Row ${item.row}: ` : ''}
              {item.message}
            </li>
          ))}
        </ul>
      )}

      {preview?.value && (
        <div className="accepted-preview p-3 bg-sim-success rounded-[6px] grid gap-2 mt-[10px] text-[11px]">
          <strong>
            {preview.value.trajectory.keyframes.length} valid keyframes
          </strong>

          <span>
            {preview.value.trajectory.keyframes[0]?.time ?? 0}s →{' '}
            {preview.value.trajectory.keyframes.at(-1)?.time ?? 0}s
          </span>

          <button
            className="primary bg-sim-accent text-[#fff] border-sim-accent [&:hover]:bg-sim-accent-hover"
            onClick={() => preview.value && onAccept(preview.value)}
          >
            Accept into draft
          </button>
        </div>
      )}
    </details>
  )
}
