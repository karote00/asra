import { useEffect, useRef, useState } from 'react'
import type { ProjectSession } from '../storage/project-session'
import { decodeProject, PROJECT_BYTE_LIMIT } from '../storage/project-format'
import { downloadText } from './download-project'

export function PortableProjectControls({
  session,
  disabled,
  name,
  unsavedRunCount,
  onImported
}: {
  session: ProjectSession
  disabled: boolean
  name: string
  unsavedRunCount: number
  onImported: (name: string) => void
}) {
  const [preview, setPreview] = useState<{
    name: string
    text: string
    bytes: number
    runs: number
    issues: number
  } | null>(null)
  const [error, setError] = useState(''),
    [reading, setReading] = useState(false)
  const request = useRef(0)
  useEffect(
    () => () => {
      request.current++
    },
    []
  )
  const read = async (file: File) => {
    const id = ++request.current
    setPreview(null)
    setReading(true)
    setError('')
    try {
      if (file.size > PROJECT_BYTE_LIMIT)
        throw new Error('Project exceeds the 64 MiB limit')
      const text = await file.text()
      if (request.current !== id) return
      const snapshot = decodeProject(text)
      setPreview({
        name: file.name,
        text,
        bytes: file.size,
        runs: snapshot.runs?.length ?? 0,
        issues: snapshot.loadIssues.length
      })
    } catch (reason) {
      if (request.current === id) setError(message(reason))
    } finally {
      if (request.current === id) setReading(false)
    }
  }
  const accept = async () => {
    if (
      !preview ||
      !window.confirm(
        `Import “${preview.name}”? This replaces the current document and starts empty Undo/Redo. Save current changes first. ${unsavedRunCount} unretained results will be lost.`
      )
    )
      return
    try {
      await session.importProject(preview.text, true)
      onImported(preview.name.replace(/\.json$/i, ''))
    } catch (reason) {
      setError(message(reason))
    }
  }
  return (
    <section className="portable-controls" aria-label="Portable project files">
      <h3>Portable project files</h3>
      <p className="hint">
        Back up models, experiments and explicitly retained results. Private
        method code is not included. Import validates before replacing the
        current document.
      </p>
      {unsavedRunCount > 0 && (
        <p className="stale-notice">
          {unsavedRunCount} results are not retained and will not be included.
          Use Runs &amp; compare to retain them first.
        </p>
      )}
      <div className="project-actions">
        <button
          disabled={disabled}
          onClick={async () => {
            try {
              const text = await session.exportProject()
              downloadText(
                `${name || 'asyra-sim'}.json`,
                text,
                'application/json'
              )
              setError('')
            } catch (reason) {
              setError(message(reason))
            }
          }}
        >
          Export project
        </button>
        <label className="file-button">
          Choose project file
          <input
            aria-label="Portable project file"
            type="file"
            accept=".json,application/json"
            disabled={disabled || reading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void read(file)
            }}
          />
        </label>
      </div>
      {reading && <p className="hint">Reading and validating project…</p>}
      {preview && (
        <div className="accepted-preview" data-testid="project-import-preview">
          <strong>{preview.name}</strong>
          <span>
            {preview.bytes.toLocaleString()} bytes - {preview.runs} retained
            runs - {preview.issues} load review requirements
          </span>
          <span>
            Historical evidence can be read without its method installed. Reruns
            require compatible methods.
          </span>
          <button disabled={disabled} onClick={() => void accept()}>
            Import and replace current project
          </button>
          <button onClick={() => setPreview(null)}>
            Discard import preview
          </button>
        </div>
      )}
      {error && (
        <p className="project-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
const message = (reason: unknown) =>
  reason instanceof Error ? reason.message : String(reason)
