import { useEffect, useRef, useState } from 'react'
import type { NormalizedTrajectorySource } from '../domain/trajectory-source'
import type { Trajectory, Workcell } from '../domain/workcell'
import {
  previewTrajectoryCsv,
  previewTrajectoryJson,
  type TrajectoryCsvMapping,
  type TrajectoryImportPreview
} from '../storage/trajectory-import'
import {
  canonicalCsvMapping,
  guessCsvMapping,
  trajectoryToCsv
} from './experiment-draft'

export function TrajectoryImportPanel({
  workcell,
  trajectory,
  onAccept
}: {
  workcell: Workcell
  trajectory: Trajectory
  onAccept: (value: NormalizedTrajectorySource) => void
}) {
  const [kind, setKind] = useState<'csv' | 'json'>('csv')
  const [text, setText] = useState(() => trajectoryToCsv(workcell, trajectory))
  const [mapping, setMapping] = useState<TrajectoryCsvMapping>(() =>
    canonicalCsvMapping(workcell)
  )
  const [preview, setPreview] = useState<TrajectoryImportPreview | null>(null)
  const [columns, setColumns] = useState<readonly string[]>(
    () => previewTrajectoryCsv(text, workcell, mapping).columns
  )
  const [error, setError] = useState('')
  const generation = useRef(0)
  const workcellKey = JSON.stringify(workcell)
  useEffect(() => {
    setPreview(null)
  }, [mapping, workcellKey])
  useEffect(
    () => () => {
      generation.current++
    },
    []
  )
  const actuated = workcell.bodies.filter((body) => body.joint.kind !== 'fixed')
  const inspect = (nextText = text, nextKind = kind, nextMapping = mapping) => {
    const next =
      nextKind === 'csv'
        ? previewTrajectoryCsv(nextText, workcell, nextMapping)
        : previewTrajectoryJson(nextText, workcell)
    setPreview(next)
    setColumns(next.columns)
    return next
  }
  const load = async (file: File, nextKind: 'csv' | 'json') => {
    const token = ++generation.current
    setError('')
    if (file.size > 1024 * 1024) {
      setError('Trajectory input exceeds the current 1 MiB import limit.')
      return
    }
    let nextText: string
    try {
      nextText = await file.text()
    } catch (reason) {
      if (token === generation.current) setError(String(reason))
      return
    }
    if (token !== generation.current) return
    setText(nextText)
    setKind(nextKind)
    setPreview(null)
    if (nextKind === 'csv') {
      const columns = previewTrajectoryCsv(
        nextText,
        workcell,
        canonicalCsvMapping(workcell)
      ).columns
      setColumns(columns)
      setMapping(guessCsvMapping(columns, workcell))
    }
  }
  const setJointMapping = (
    id: string,
    value: TrajectoryCsvMapping['joints'][string]
  ) =>
    setMapping((current) => ({
      ...current,
      joints: { ...current.joints, [id]: value }
    }))
  return (
    <details className="trajectory-import" open>
      <summary>
        Trajectory input <span>preview before acceptance</span>
      </summary>
      <p className="hint">
        CSV units are mapped explicitly. JSON must use the strict
        <code> asyra-sim-trajectory v1</code> envelope. Preview never edits the
        project.
      </p>
      <div className="file-row">
        <label className="file-button">
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
        <label className="file-button">
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
        <span className="format-tag">{kind.toUpperCase()}</span>
      </div>
      {error && (
        <p className="inline-error" role="alert">
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
            setText(event.target.value)
            setPreview(null)
          }}
        />
      </label>
      {kind === 'csv' && (
        <div className="mapping-grid">
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
              <div className="mapping-row" key={body.id}>
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
      <button className="wide" onClick={() => inspect()}>
        Preview trajectory
      </button>
      {preview && preview.diagnostics.length > 0 && (
        <ul className="diagnostic-list" role="alert">
          {preview.diagnostics.slice(0, 20).map((item, index) => (
            <li key={`${item.code}:${item.row ?? 0}:${index}`}>
              {item.row ? `Row ${item.row}: ` : ''}
              {item.message}
            </li>
          ))}
        </ul>
      )}
      {preview?.value && (
        <div className="accepted-preview">
          <strong>
            {preview.value.trajectory.keyframes.length} valid keyframes
          </strong>
          <span>
            {preview.value.trajectory.keyframes[0]?.time ?? 0}s →{' '}
            {preview.value.trajectory.keyframes.at(-1)?.time ?? 0}s
          </span>
          <button
            className="primary"
            onClick={() => preview.value && onAccept(preview.value)}
          >
            Accept into draft
          </button>
        </div>
      )}
    </details>
  )
}
