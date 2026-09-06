import type { ProjectSession } from '../../storage/project-session'
import { ToolbarButton } from '../shell/toolbar-button'
import { PortableProjectControls } from './portable-project-controls'
import { useProjectControls } from './use-project-controls'

export function ProjectControls({
  session,
  ready,
  unsavedRunCount = 0
}: {
  session: ProjectSession
  ready: boolean
  unsavedRunCount?: number
}) {
  const {
    state,
    open,
    setOpen,
    name,
    setName,
    projects,
    limited,
    listing,
    problem,
    setProblem,
    dialog,
    refresh,
    save,
    choose,
    caption,
    saveCurrent
  } = useProjectControls({ session, unsavedRunCount })

  return (
    <>
      <div
        className="project-controls max-[700px]:[&_>_span]:hidden flex items-center gap-2
          [&_>_span]:text-[10px] [&_>_span]:max-w-55 [&_>_span]:overflow-hidden
          [&_>_span]:text-ellipsis [&_>_span]:whitespace-nowrap
          [&_>_span]:text-sim-secondary"
      >
        <span data-testid="persistence-status">{caption}</span>

        <ToolbarButton
          label="Save"
          disabled={!ready || !!state.busy}
          onClick={saveCurrent}
        >
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h9V3M7 21v-8h10v8M13 5v2" />
        </ToolbarButton>

        <ToolbarButton
          label="Projects"
          title="Projects - Manage local saves and project files"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setOpen(true)

            setName(state.project?.name ?? name)

            void refresh()
          }}
        >
          <path d="M3 8V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v1M3 8h16a2 2 0 0 1 2 2l-2 9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
        </ToolbarButton>
      </div>

      {open && (
        <dialog
          ref={dialog}
          className="project-dialog [width:min(560px,_calc(100vw_-_40px))]
            [max-height:calc(100dvh_-_60px)] p-6 border border-sim-border
            rounded-[12px] text-sim-text shadow-[0_24px_80px_#101f2a40]
            [&::backdrop]:bg-[#101f2a80] [&_form]:my-5 [&_form]:mx-0"
          aria-label="Local projects"
          onCancel={() => setOpen(false)}
        >
          <div
            className="project-dialog-heading flex gap-3 items-center justify-between mb-[14px]
              [&_h2]:mt-[6px] [&_h2]:text-[20px]"
          >
            <div>
              <span className="eyebrow text-[9px] tracking-[1.3px] text-sim-muted font-bold">
                ON THIS BROWSER
              </span>

              <h2>Local projects</h2>
            </div>

            <button aria-label="Close projects" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
            Private, origin-local browser storage. Clearing site data removes
            these saves; this is not a backup.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault()

              void save()
            }}
          >
            <label>
              Project name
              <input
                value={name}
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <div className="project-actions flex gap-3 items-center justify-between mb-[14px] justify-start mt-[10px]">
              <button
                className="primary bg-sim-accent text-[#fff] border-sim-accent [&:hover]:bg-sim-accent-hover"
                disabled={!ready || !!state.busy}
                type="submit"
              >
                Save project
              </button>

              <button
                disabled={!ready || !!state.busy}
                type="button"
                onClick={() => void save(true)}
              >
                Save copy
              </button>
            </div>
          </form>

          <PortableProjectControls
            session={session}
            disabled={!ready || !!state.busy}
            name={name}
            unsavedRunCount={unsavedRunCount}
            onImported={(importedName) => {
              setName(importedName)

              setProblem('')

              setOpen(false)
            }}
          />

          {(problem || state.error) && (
            <p
              className="project-error p-3 bg-sim-error text-sim-error-text rounded-[6px] my-[14px] mx-0 leading-[1.6]"
              role="alert"
            >
              {problem || state.error}
            </p>
          )}

          <div className="project-list-heading flex gap-3 items-center justify-between mb-[14px]">
            <h3>Saved projects</h3>

            <button
              disabled={listing || !!state.busy}
              onClick={() => void refresh()}
            >
              Refresh
            </button>
          </div>

          {listing && (
            <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
              Reading local storage…
            </p>
          )}

          {!listing && projects.length === 0 && (
            <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
              No saved projects listed.
            </p>
          )}

          {limited && (
            <p className="hint text-[10px] leading-[1.6] text-sim-muted font-normal">
              Showing only the 100 most recently saved projects.
            </p>
          )}

          <ul
            className="project-list list-none m-0 p-0 [&_li]:flex [&_li]:items-center
              [&_li]:gap-4 [&_li]:justify-between [&_li]:py-[14px] [&_li]:px-0
              [&_li]:border-t [&_li]:border-t-sim-divider [&_li_>_div]:min-w-0
              [&_li_>_div]:flex [&_li_>_div]:flex-col [&_li_>_div]:gap-[6px]
              [&_strong]:wrap-anywhere [&_span]:text-sim-muted [&_span]:text-[10px]"
          >
            {projects.map((project) => (
              <li key={project.id}>
                <div>
                  <strong>{project.name}</strong>

                  <span>{new Date(project.savedAt).toLocaleString()}</span>
                </div>

                <button
                  disabled={!ready || !!state.busy}
                  aria-label={`Open ${project.name}`}
                  onClick={() => void choose(project)}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </dialog>
      )}
    </>
  )
}
