import type { ProjectSession } from '../../storage/project-session'
import { usePortableProject } from './use-portable-project'

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
  const { preview, setPreview, error, reading, read, accept, exportProject } =
    usePortableProject({ session, name, unsavedRunCount, onImported })

  return (
    <section
      className="portable-controls border-y border-y-sim-divider py-4 px-0 my-[18px] mx-0 [&_>_.hint]:mt-[10px]"
      aria-label="Portable project files"
    >
      <h3>Portable project files</h3>

      <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
        Back up models, experiments and explicitly retained results. Private
        method code is not included. Import validates before replacing the
        current document.
      </p>

      {unsavedRunCount > 0 && (
        <p className="stale-notice bg-sim-warning text-sim-warning-text p-[10px] rounded-[5px] text-[10px] leading-[1.6]">
          {unsavedRunCount} results are not retained and will not be included.
          Use Runs &amp; compare to retain them first.
        </p>
      )}

      <div className="project-actions flex gap-3 items-center justify-between mb-[14px] justify-start mt-[10px]">
        <button disabled={disabled} onClick={exportProject}>
          Export project
        </button>

        <label
          className="file-button inline-block cursor-pointer py-[7px] px-[10px] border
            border-sim-border rounded-[5px] text-[10px] [&_input]:hidden
            [&:focus-within]:[outline:2px_solid_var(--sim-focus)]"
        >
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

      {reading && (
        <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
          Reading and validating project…
        </p>
      )}

      {preview && (
        <div
          className="accepted-preview p-3 bg-sim-success rounded-[6px] grid gap-2 mt-[10px] text-[11px]"
          data-testid="project-import-preview"
        >
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
        <p
          className="project-error p-3 bg-sim-error text-sim-error-text rounded-[6px] my-[14px] mx-0 leading-[1.6]"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  )
}
