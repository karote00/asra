import { useEffect, useRef, useState } from 'react'
import {
  OBSERVATION_LIMITS,
  observationMediaType
} from '../common-apis/observation-contract'
import type { ObservationStorageApi } from '../features/storage-observations'
import type { PreparedObservationAttachments } from '../storage/observation-archive'

type PreparationApi = Pick<ObservationStorageApi, 'prepare' | 'discard'>

export function useObservationFiles(
  api: PreparationApi,
  isCurrent: () => boolean
) {
  const [prepared, setPrepared] =
    useState<PreparedObservationAttachments | null>(null)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const current = useRef(isCurrent)
  current.current = isCurrent
  const generation = useRef(0),
    mounted = useRef(true)
  const abort = useRef<AbortController | null>(null)
  const receipt = useRef<PreparedObservationAttachments | null>(null)
  const discard = (value: PreparedObservationAttachments) => {
    try {
      api.discard(value)
    } catch {
      /* A retired runtime owns final resource disposal. */
    }
  }
  const release = () => {
    generation.current++
    abort.current?.abort()
    abort.current = null
    if (receipt.current) discard(receipt.current)
    receipt.current = null
  }
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      release()
    }
  }, [api])
  const clear = () => {
    release()
    setPrepared(null)
    setBusy(false)
    setError('')
  }
  const select = async (files: readonly File[], available: number) => {
    clear()
    if (!files.length) return
    const ticket = generation.current
    const active = () =>
      mounted.current && ticket === generation.current && current.current()
    if (!active()) return
    const controller = new AbortController()
    abort.current = controller
    try {
      if (
        files.length >
        Math.min(available, OBSERVATION_LIMITS.attachmentsPerNote)
      )
        throw new Error(
          'At most 4 attachments are allowed per observation, including existing files.'
        )
      for (const file of files) {
        if (!observationMediaType(file.name))
          throw new Error(
            'Choose a TXT, CSV, JSON, PNG, JPG, JPEG or PDF file with a valid basename.'
          )
        if (
          !Number.isSafeInteger(file.size) ||
          file.size < 1 ||
          file.size > OBSERVATION_LIMITS.fileBytes
        )
          throw new Error(
            'Each observation file must contain 1 byte to 2 MiB. No files were read.'
          )
      }
      setBusy(true)
      const inputs = await Promise.all(
        files.map(async (file) => ({
          filename: file.name,
          bytes: new Uint8Array(await file.arrayBuffer())
        }))
      )
      if (!active()) return
      const value = await api.prepare(inputs, { signal: controller.signal })
      if (!active()) {
        discard(value)
        return
      }
      receipt.current = value
      setPrepared(value)
    } catch (reason) {
      if (active())
        setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (active()) {
        setBusy(false)
        abort.current = null
      }
    }
  }
  return { prepared, busy, error, select, clear }
}
