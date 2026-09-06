import { useEffect, useRef, useState } from 'react'
import type { SimRuntime } from '../init/bootstrap'
import {
  OBSERVATION_LIMITS,
  validObservationDraft,
  type FieldObservation,
  type ObservationAttachmentReference
} from '../common-apis/observation-contract'
import { downloadBytes, downloadText } from './download-project'
import { useObservationFiles } from './use-observation-files'
import './field-observations.css'

export type ObservationAccess = Pick<
  SimRuntime,
  'getObservations' | 'getObservationAttachment' | 'exportObservations'
> & {
  features: {
    edit: Pick<
      SimRuntime['features']['edit'],
      'addObservation' | 'updateObservation' | 'removeObservation'
    >
    observations: SimRuntime['features']['observations']
  }
}

function AttachmentDetails({
  reference
}: {
  reference: ObservationAttachmentReference
}) {
  return (
    <div className="observation-attachment-details">
      <strong>{reference.filename}</strong>
      <span>
        {reference.byteLength.toLocaleString()} bytes - declared{' '}
        {reference.mediaType}
      </span>
      <code>{reference.sourceId}</code>
    </div>
  )
}

export function FieldObservations({
  runtime,
  runId,
  retained,
  isCurrent
}: {
  runtime: ObservationAccess
  runId: string
  retained: boolean
  isCurrent: () => boolean
}) {
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<FieldObservation | null>(null)
  const [title, setTitle] = useState(''),
    [text, setText] = useState('')
  const [existing, setExisting] = useState<
    readonly ObservationAttachmentReference[]
  >([])
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState('')
  const files = useObservationFiles(runtime.features.observations, isCurrent)
  const mounted = useRef(true),
    generation = useRef(0)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generation.current++
    }
  }, [])
  let notes: readonly FieldObservation[] = [],
    readError = ''
  if (retained) {
    try {
      notes = runtime.getObservations(runId)
    } catch (reason) {
      readError = message(reason)
    }
  }
  const current = editing
    ? notes.find((note) => note.id === editing.id)
    : undefined
  const stale =
    editing !== null && JSON.stringify(current) !== JSON.stringify(editing)
  const draft = {
    title,
    text,
    attachments: [...existing, ...(files.prepared?.attachments ?? [])]
  }
  const reset = () => {
    generation.current++
    files.clear()
    setOpen(false)
    setEditing(null)
    setTitle('')
    setText('')
    setExisting([])
    setSaving(false)
    setError('')
    setStatus('')
  }
  const begin = (note?: FieldObservation) => {
    reset()
    setOpen(true)
    if (note) {
      setEditing(structuredClone(note))
      setTitle(note.title)
      setText(note.text)
      setExisting(structuredClone(note.attachments))
    }
  }
  const save = async () => {
    if (!validObservationDraft(draft) || stale || files.busy || files.error)
      return
    const ticket = generation.current
    const active = () =>
      mounted.current && ticket === generation.current && isCurrent()
    if (!active()) return
    setSaving(true)
    setError('')
    try {
      if (files.prepared) {
        await runtime.features.observations.retain(files.prepared, {
          runId,
          draft,
          ...(editing
            ? { edit: { id: editing.id, expectedRevision: editing.revision } }
            : {})
        })
      } else if (editing)
        await runtime.features.edit.updateObservation(
          runId,
          editing.id,
          editing.revision,
          draft
        )
      else await runtime.features.edit.addObservation(runId, draft)
      if (active()) {
        reset()
        setStatus(
          'Observation retained - save the project for durable storage. One Undo action for a material change.'
        )
      }
    } catch (reason) {
      if (active()) setError(message(reason))
    } finally {
      if (active()) setSaving(false)
    }
  }
  const remove = async (note: FieldObservation) => {
    if (
      !isCurrent() ||
      !window.confirm(`Remove observation "${note.title}"? This can be undone.`)
    )
      return
    const ticket = generation.current
    setSaving(true)
    setError('')
    try {
      await runtime.features.edit.removeObservation(
        runId,
        note.id,
        note.revision
      )
      if (mounted.current && ticket === generation.current && isCurrent()) {
        reset()
        setStatus(
          'Observation removed - Undo can restore it. Save the project to persist this change.'
        )
      }
    } catch (reason) {
      if (mounted.current && isCurrent()) setError(message(reason))
    } finally {
      if (mounted.current && ticket === generation.current && isCurrent())
        setSaving(false)
    }
  }
  const download = (action: () => void) => {
    if (!isCurrent()) return
    try {
      action()
      setError('')
    } catch (reason) {
      setError(message(reason))
    }
  }
  return (
    <section className="field-observations" aria-label="Field observations">
      <div className="section-heading">
        <h3>Field observations</h3>
        <span className="run-retention-label">
          {notes.length}/{OBSERVATION_LIMITS.perRun} notes
        </span>
      </div>
      <p className="hint">
        User-reported real-world checks, separate from immutable experiment
        evidence. These notes do not validate a method or change its verdict.
      </p>
      {!retained ? (
        <p className="hint">
          Retain this result first to add field observations.
        </p>
      ) : (
        <>
          {readError ? (
            <p className="inline-error" role="alert">
              Cannot read observations: {readError}
            </p>
          ) : (
            <>
              <div className="run-detail-actions">
                <button
                  disabled={
                    saving || open || notes.length >= OBSERVATION_LIMITS.perRun
                  }
                  onClick={() => begin()}
                >
                  Add field observation
                </button>
                <button
                  disabled={!notes.length}
                  onClick={() =>
                    download(() =>
                      downloadText(
                        `sim-${runId}-observations.json`,
                        runtime.exportObservations(runId),
                        'application/json'
                      )
                    )
                  }
                >
                  Export field observations
                </button>
              </div>
              {notes.map((note) => (
                <article
                  className="observation-note"
                  key={note.id}
                  data-observation-id={note.id}
                >
                  <div className="section-heading">
                    <h4>{note.title}</h4>
                    <span className="run-retention-label">
                      revision {note.revision}
                    </span>
                  </div>
                  <p className="observation-text">{note.text}</p>
                  <p className="hint">
                    Created {note.createdAt} - Updated {note.updatedAt}
                  </p>
                  {note.attachments.map((reference) => (
                    <div
                      className="observation-attachment"
                      key={reference.sourceId}
                    >
                      <AttachmentDetails reference={reference} />
                      <button
                        onClick={() =>
                          download(() =>
                            downloadBytes(
                              reference.filename,
                              runtime.getObservationAttachment(reference),
                              'application/octet-stream'
                            )
                          )
                        }
                      >
                        Download {reference.filename}
                      </button>
                    </div>
                  ))}
                  <div className="run-detail-actions">
                    <button disabled={saving} onClick={() => begin(note)}>
                      Edit observation
                    </button>
                    <button disabled={saving} onClick={() => void remove(note)}>
                      Remove observation
                    </button>
                  </div>
                </article>
              ))}
              {open && (
                <fieldset className="observation-editor" disabled={saving}>
                  <legend>
                    {editing
                      ? 'Edit field observation'
                      : 'New field observation'}
                  </legend>
                  <label>
                    Title
                    <input
                      aria-label="Observation title"
                      value={title}
                      maxLength={OBSERVATION_LIMITS.title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </label>
                  <label>
                    Observation
                    <textarea
                      aria-label="Observation text"
                      rows={4}
                      value={text}
                      maxLength={OBSERVATION_LIMITS.text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="What was measured or observed, under which real-world conditions?"
                    />
                  </label>
                  <span className="hint">
                    {text.length.toLocaleString()}/
                    {OBSERVATION_LIMITS.text.toLocaleString()} characters -
                    Include units and measurement context.
                  </span>
                  {existing.map((reference) => (
                    <div
                      className="observation-attachment"
                      key={reference.sourceId}
                    >
                      <AttachmentDetails reference={reference} />
                      <button
                        onClick={() =>
                          setExisting(
                            existing.filter(
                              (item) => item.sourceId !== reference.sourceId
                            )
                          )
                        }
                      >
                        Remove attachment {reference.filename}
                      </button>
                    </div>
                  ))}
                  <label>
                    Supporting files
                    <input
                      type="file"
                      aria-label="Observation attachments"
                      multiple
                      disabled={files.busy}
                      accept=".txt,.csv,.json,.png,.jpg,.jpeg,.pdf"
                      onChange={(event) => {
                        const selected = Array.from(event.target.files ?? [])
                        event.target.value = ''
                        void files.select(
                          selected,
                          OBSERVATION_LIMITS.attachmentsPerNote -
                            existing.length
                        )
                      }}
                    />
                  </label>
                  <p className="hint">
                    Up to 4 files, 2 MiB each. Files are stored as opaque bytes,
                    not opened, parsed, scanned or verified as safe. The archive
                    allows 64 sources / 16 MiB, including Undo-retained files.
                  </p>
                  {files.busy && (
                    <p className="hint">Preparing attachments locally…</p>
                  )}
                  {files.prepared && (
                    <div aria-label="Prepared observation attachments">
                      <p className="hint">
                        {files.prepared.attachments.length} new files prepared -
                        not yet retained. Review these before saving the
                        observation.
                      </p>
                      {files.prepared.attachments.map((reference) => (
                        <div
                          className="observation-attachment"
                          key={reference.sourceId}
                        >
                          <AttachmentDetails reference={reference} />
                        </div>
                      ))}
                    </div>
                  )}
                  {(files.busy || files.prepared || files.error) && (
                    <button onClick={files.clear}>Clear new files</button>
                  )}
                  {files.error && (
                    <p className="inline-error" role="alert">
                      {files.error}
                    </p>
                  )}
                  {stale && !saving && (
                    <p className="inline-error" role="alert">
                      This observation changed since this draft was opened.{' '}
                      {current ? (
                        <button onClick={() => begin(current)}>
                          Reload current observation
                        </button>
                      ) : (
                        'Discard this draft; the observation is no longer present.'
                      )}
                    </p>
                  )}
                  <div className="run-detail-actions">
                    <button
                      className="primary"
                      disabled={
                        !validObservationDraft(draft) ||
                        stale ||
                        files.busy ||
                        !!files.error
                      }
                      onClick={() => void save()}
                    >
                      Save observation
                    </button>
                    <button onClick={reset}>Discard draft</button>
                  </div>
                </fieldset>
              )}
            </>
          )}
        </>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="hint" aria-live="polite">
          {status}
        </p>
      )}
    </section>
  )
}
function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}
