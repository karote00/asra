import { useEffect, useRef, useState } from 'react'
import { decodeProject, PROJECT_BYTE_LIMIT } from '../../storage/project-format'
import type { ProjectSession } from '../../storage/project-session'
import { errorMessage } from '../shared/error-message'
import { downloadText } from './download-project'

export function usePortableProject({
  session,
  name,
  unsavedRunCount,
  onImported
}: {
  session: ProjectSession
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

  const [error, setError] = useState('')

  const [reading, setReading] = useState(false)

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
      if (request.current === id) setError(errorMessage(reason))
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
      setError(errorMessage(reason))
    }
  }

  const exportProject = async () => {
    try {
      const text = await session.exportProject()

      downloadText(`${name || 'asyra-sim'}.json`, text, 'application/json')

      setError('')
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  return {
    preview,
    setPreview,
    error,
    setError,
    reading,
    read,
    accept,
    exportProject
  }
}
