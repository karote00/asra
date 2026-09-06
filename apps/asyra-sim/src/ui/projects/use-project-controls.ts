import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ProjectSummary } from '../../storage/project-format'
import type { ProjectSession } from '../../storage/project-session'
import { errorMessage } from '../shared/error-message'

export function useProjectControls({
  session,
  unsavedRunCount = 0
}: {
  session: ProjectSession
  unsavedRunCount?: number
}) {
  const state = useSyncExternalStore(session.subscribe, session.getState)

  const [open, setOpen] = useState(false)

  const [name, setName] = useState('Untitled project')

  const [projects, setProjects] = useState<ProjectSummary[]>([])

  const [limited, setLimited] = useState(false)

  const [listing, setListing] = useState(false)

  const [problem, setProblem] = useState('')

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
      if (id === request.current) setProblem(errorMessage(error))
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
      setProblem(errorMessage(error))
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
      setProblem(errorMessage(error))
    }
  }

  let caption = 'Unsaved changes'

  if (state.busy === 'open') caption = 'Opening…'
  else if (state.busy === 'export') caption = 'Preparing export…'
  else if (state.status === 'saving') caption = 'Saving…'
  else if (state.status === 'saved')
    caption = `Saved locally - ${state.project?.name}`
  else if (state.status === 'error')
    caption = 'Save/open error - changes not acknowledged'

  const saveCurrent = () => {
    setName(state.project?.name ?? name)

    if (!state.project) {
      setOpen(true)

      void refresh()
    } else
      void session.save(state.project.name).catch((error) => {
        setProblem(errorMessage(error))

        setOpen(true)
      })
  }

  return {
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
  }
}
