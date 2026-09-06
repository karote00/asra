import { useEffect, useRef, useState } from 'react'
import {
  validObservationDraft,
  type FieldObservation,
  type ObservationAttachmentReference
} from '../../common-apis/observation-contract'
import { downloadBytes, downloadText } from '../projects/download-project'
import { errorMessage } from '../shared/error-message'
import type { ObservationAccess } from './observation-access'
import { useObservationFiles } from './use-observation-files'

export function useObservationController({
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
  const [open, setOpen] = useState(false)

  const [editing, setEditing] = useState<FieldObservation | null>(null)

  const [title, setTitle] = useState('')

  const [text, setText] = useState('')

  const [existing, setExisting] = useState<
    readonly ObservationAttachmentReference[]
  >([])

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')

  const [status, setStatus] = useState('')

  const files = useObservationFiles(runtime.features.observations, isCurrent)

  const mounted = useRef(true)

  const generation = useRef(0)

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false

      generation.current++
    }
  }, [])

  let notes: readonly FieldObservation[] = []

  let readError = ''

  if (retained) {
    try {
      notes = runtime.getObservations(runId)
    } catch (reason) {
      readError = errorMessage(reason)
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
      if (active()) setError(errorMessage(reason))
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
      if (mounted.current && isCurrent()) setError(errorMessage(reason))
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
      setError(errorMessage(reason))
    }
  }

  const exportObservations = () =>
    download(() =>
      downloadText(
        `sim-${runId}-observations.json`,
        runtime.exportObservations(runId),
        'application/json'
      )
    )

  const downloadAttachment = (reference: ObservationAttachmentReference) =>
    download(() =>
      downloadBytes(
        reference.filename,
        runtime.getObservationAttachment(reference),
        'application/octet-stream'
      )
    )

  return {
    exportObservations,
    downloadAttachment,
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
    download
  }
}
