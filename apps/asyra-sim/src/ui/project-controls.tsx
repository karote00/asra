import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ProjectSession } from '../storage/project-session'
import type { ProjectSummary } from '../storage/project-format'
import { PortableProjectControls } from './portable-project-controls'

export function ProjectControls({
  session,
  ready,
  unsavedRunCount = 0
}: {
  session: ProjectSession
  ready: boolean
  unsavedRunCount?: number
}) {
  const state = useSyncExternalStore(session.subscribe, session.getState)
  const [open, setOpen] = useState(false),
    [name, setName] = useState('Untitled project')
  const [projects, setProjects] = useState<ProjectSummary[]>([]),
    [limited, setLimited] = useState(false)
  const [listing, setListing] = useState(false),
    [problem, setProblem] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef(0)
  useEffect(() => {
    if (!open) return
    const element = dialog.current
    element?.showModal()
    return () => {
      element?.close()
      request.current++
    }
  }, [open])
  const refresh = async () => {
    const id = ++request.current
    setListing(true)
    try {
      const result = await session.list()
      if (id !== request.current) return
      setProjects(result.projects)
      setLimited(result.limited)
      setProblem('')
    } catch (error) {
      if (id === request.current) setProblem(message(error))
    } finally {
      if (id === request.current) setListing(false)
    }
  }
  const save = async (copy = false) => {
    try {
      await session.save(name, copy)
      setProblem('')
      await refresh()
    } catch (error) {
      setProblem(message(error))
    }
  }
  const choose = async (project: ProjectSummary) => {
    const warning = state.dirty
      ? ' Current unsaved changes will be replaced.'
      : ''
    if (
      !window.confirm(
        `Open “${project.name}”?${warning} This starts a new document with empty Undo/Redo. ${unsavedRunCount} unretained results will be lost.`
      )
    )
      return
    try {
      await session.open(project.id, true)
      setName(project.name)
      setProblem('')
      setOpen(false)
    } catch (error) {
      setProblem(message(error))
    }
  }
  let caption = 'Unsaved changes'
  if (state.busy === 'open') caption = 'Opening…'
  else if (state.busy === 'export') caption = 'Preparing export…'
  else if (state.status === 'saving') caption = 'Saving…'
  else if (state.status === 'saved')
    caption = `Saved locally · ${state.project?.name}`
  else if (state.status === 'error')
    caption = 'Save/open error · changes not acknowledged'
  return (
    <>
      <div className="project-controls">
        <span data-testid="persistence-status">{caption}</span>
        <button
          disabled={!ready || !!state.busy}
          onClick={() => {
            setName(state.project?.name ?? name)
            if (!state.project) {
              setOpen(true)
              void refresh()
            } else
              void session.save(state.project.name).catch((error) => {
                setProblem(message(error))
                setOpen(true)
              })
          }}
        >
          Save
        </button>
        <button
          onClick={() => {
            setOpen(true)
            setName(state.project?.name ?? name)
            void refresh()
          }}
        >
          Projects
        </button>
      </div>
      {open && (
        <dialog
          ref={dialog}
          className="project-dialog"
          aria-label="Local projects"
          onCancel={() => setOpen(false)}
        >
          <div className="project-dialog-heading">
            <div>
              <span className="eyebrow">ON THIS BROWSER</span>
              <h2>Local projects</h2>
            </div>
            <button aria-label="Close projects" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <p className="hint">
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
            <div className="project-actions">
              <button
                className="primary"
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
            <p className="project-error" role="alert">
              {problem || state.error}
            </p>
          )}
          <div className="project-list-heading">
            <h3>Saved projects</h3>
            <button
              disabled={listing || !!state.busy}
              onClick={() => void refresh()}
            >
              Refresh
            </button>
          </div>
          {listing && <p className="hint">Reading local storage…</p>}
          {!listing && projects.length === 0 && (
            <p className="hint">No saved projects listed.</p>
          )}
          {limited && (
            <p className="hint">
              Showing only the 100 most recently saved projects.
            </p>
          )}
          <ul className="project-list">
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

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
