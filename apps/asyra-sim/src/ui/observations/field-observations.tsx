import { OBSERVATION_LIMITS } from '../../common-apis/observation-contract'
import { AttachmentDetails } from './attachment-details'
import { ObservationAccess } from './observation-access'
import { ObservationEditor } from './observation-editor'
import { useObservationController } from './use-observation-controller'

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
  const {
    open,
    editing,
    title,
    setTitle,
    text,
    setText,
    existing,
    setExisting,
    saving,
    error,
    status,
    files,
    notes,
    readError,
    current,
    stale,
    draft,
    reset,
    begin,
    save,
    remove,
    exportObservations,
    downloadAttachment
  } = useObservationController({ runtime, runId, retained, isCurrent })

  return (
    <section
      className="field-observations border-t border-t-sim-border mt-5 pt-[18px] [&_h4]:m-0 [&_h4]:wrap-anywhere"
      aria-label="Field observations"
    >
      <div className="section-heading flex items-center justify-between [&_>_span]:text-[10px] [&_>_span]:text-sim-muted">
        <h3>Field observations</h3>

        <span className="run-retention-label text-[10px] text-sim-muted">
          {notes.length}/{OBSERVATION_LIMITS.perRun} notes
        </span>
      </div>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        User-reported real-world checks, separate from immutable experiment
        evidence. These notes do not validate a method or change its verdict.
      </p>

      {!retained ? (
        <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
          Retain this result first to add field observations.
        </p>
      ) : (
        <>
          {readError ? (
            <p
              className="inline-error text-sim-error-text bg-sim-error p-[11px] rounded-[5px]
                text-[11px] leading-[1.6] wrap-anywhere"
              role="alert"
            >
              Cannot read observations: {readError}
            </p>
          ) : (
            <>
              <div className="run-detail-actions flex flex-wrap gap-2 my-3 mx-0 [&_button]:text-[11px]">
                <button
                  disabled={
                    saving || open || notes.length >= OBSERVATION_LIMITS.perRun
                  }
                  onClick={() => begin()}
                >
                  Add field observation
                </button>

                <button disabled={!notes.length} onClick={exportObservations}>
                  Export field observations
                </button>
              </div>

              {notes.map((note) => (
                <article
                  className="observation-note border border-sim-border rounded-[6px] my-3 mx-0 p-[14px]"
                  key={note.id}
                  data-observation-id={note.id}
                >
                  <div className="section-heading flex items-center justify-between [&_>_span]:text-[10px] [&_>_span]:text-sim-muted">
                    <h4>{note.title}</h4>

                    <span className="run-retention-label text-[10px] text-sim-muted">
                      revision {note.revision}
                    </span>
                  </div>

                  <p
                    className="observation-text whitespace-pre-wrap wrap-anywhere max-h-45
                      overflow-auto text-[12px] leading-[1.7]"
                  >
                    {note.text}
                  </p>

                  <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
                    Created {note.createdAt} - Updated {note.updatedAt}
                  </p>

                  {note.attachments.map((reference) => (
                    <div
                      className="observation-attachment flex flex-wrap items-center gap-2 border-t
                        border-t-sim-divider py-[10px] px-0"
                      key={reference.sourceId}
                    >
                      <AttachmentDetails reference={reference} />

                      <button onClick={() => downloadAttachment(reference)}>
                        Download {reference.filename}
                      </button>
                    </div>
                  ))}

                  <div className="run-detail-actions flex flex-wrap gap-2 my-3 mx-0 [&_button]:text-[11px]">
                    <button disabled={saving} onClick={() => begin(note)}>
                      Edit observation
                    </button>

                    <button disabled={saving} onClick={() => void remove(note)}>
                      Remove observation
                    </button>
                  </div>
                </article>
              ))}

              <ObservationEditor
                open={open}
                editing={editing}
                title={title}
                setTitle={setTitle}
                text={text}
                setText={setText}
                existing={existing}
                setExisting={setExisting}
                saving={saving}
                files={files}
                current={current}
                stale={stale}
                draft={draft}
                reset={reset}
                begin={begin}
                save={save}
              />
            </>
          )}
        </>
      )}

      {error && (
        <p
          className="inline-error text-sim-error-text bg-sim-error p-[11px] rounded-[5px]
            text-[11px] leading-[1.6] wrap-anywhere"
          role="alert"
        >
          {error}
        </p>
      )}

      {status && (
        <p
          className="hint text-[10px] leading-[1.6] text-sim-muted font-normal"
          aria-live="polite"
        >
          {status}
        </p>
      )}
    </section>
  )
}
