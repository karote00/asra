import {
  OBSERVATION_LIMITS,
  validObservationDraft
} from '../../common-apis/observation-contract'
import { AttachmentDetails } from './attachment-details'
import { useObservationController } from './use-observation-controller'

type Props = Pick<
  ReturnType<typeof useObservationController>,
  | 'open'
  | 'editing'
  | 'title'
  | 'setTitle'
  | 'text'
  | 'setText'
  | 'existing'
  | 'setExisting'
  | 'saving'
  | 'files'
  | 'current'
  | 'stale'
  | 'draft'
  | 'reset'
  | 'begin'
  | 'save'
>

export function ObservationEditor({
  open,
  editing,
  title,
  setTitle,
  text,
  setText,
  existing,
  setExisting,
  saving,
  files,
  current,
  stale,
  draft,
  reset,
  begin,
  save
}: Props) {
  return (
    <>
      {open && (
        <fieldset
          className="observation-editor border border-sim-border rounded-[6px] mt-[14px]
            p-[14px] grid gap-[10px] min-w-0 [&_label]:grid [&_label]:gap-[6px]
            [&_label]:text-[12px] [&_input]:w-full [&_input]:box-border
            [&_input]:min-w-0 [&_textarea]:w-full [&_textarea]:box-border
            [&_textarea]:min-w-0 [&_textarea]:[font:inherit]
            [&_textarea]:leading-[1.6] [&_textarea]:p-2 [&_textarea]:border
            [&_textarea]:border-sim-border [&_textarea]:rounded-[4px]
            [&_textarea]:resize-y"
          disabled={saving}
        >
          <legend>
            {editing ? 'Edit field observation' : 'New field observation'}
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

          <span className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
            {text.length.toLocaleString()}/
            {OBSERVATION_LIMITS.text.toLocaleString()} characters - Include
            units and measurement context.
          </span>

          {existing.map((reference) => (
            <div
              className="observation-attachment flex flex-wrap items-center gap-2 border-t
                border-t-sim-divider py-[10px] px-0"
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
                  OBSERVATION_LIMITS.attachmentsPerNote - existing.length
                )
              }}
            />
          </label>

          <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
            Up to 4 files, 2 MiB each. Files are stored as opaque bytes, not
            opened, parsed, scanned or verified as safe. The archive allows 64
            sources / 16 MiB, including Undo-retained files.
          </p>

          {files.busy && (
            <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
              Preparing attachments locally…
            </p>
          )}

          {files.prepared && (
            <div aria-label="Prepared observation attachments">
              <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
                {files.prepared.attachments.length} new files prepared - not yet
                retained. Review these before saving the observation.
              </p>

              {files.prepared.attachments.map((reference) => (
                <div
                  className="observation-attachment flex flex-wrap items-center gap-2 border-t
                    border-t-sim-divider py-[10px] px-0"
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
            <p
              className="inline-error text-sim-error-text bg-sim-error p-[11px] rounded-[5px]
                text-[11px] leading-[1.6] wrap-anywhere"
              role="alert"
            >
              {files.error}
            </p>
          )}

          {stale && !saving && (
            <p
              className="inline-error text-sim-error-text bg-sim-error p-[11px] rounded-[5px]
                text-[11px] leading-[1.6] wrap-anywhere"
              role="alert"
            >
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

          <div className="run-detail-actions flex flex-wrap gap-2 my-3 mx-0 [&_button]:text-[11px]">
            <button
              className="primary bg-sim-accent text-[#fff] border-sim-accent [&:hover]:bg-sim-accent-hover"
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
  )
}
