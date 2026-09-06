import { useEffect, useRef, useState } from 'react'
import type { Trajectory, Workcell } from '../../domain/workcell'
import {
  previewTrajectoryCsv,
  previewTrajectoryJson,
  TRAJECTORY_IMPORT_LIMITS,
  type TrajectoryCsvMapping,
  type TrajectoryImportPreview
} from '../../storage/trajectory-import'
import {
  canonicalCsvMapping,
  guessCsvMapping,
  trajectoryToCsv
} from '../experiments/experiment-draft'

export function useTrajectoryImport({
  workcell,
  trajectory
}: {
  workcell: Workcell
  trajectory: Trajectory
}) {
  const [kind, setKind] = useState<'csv' | 'json'>('csv')

  const [text, setText] = useState(() => trajectoryToCsv(workcell, trajectory))

  const [mapping, setMapping] = useState<TrajectoryCsvMapping>(() =>
    canonicalCsvMapping(workcell)
  )

  const [preview, setPreview] = useState<TrajectoryImportPreview | null>(null)

  const [columns, setColumns] = useState<readonly string[]>(
    () => previewTrajectoryCsv(text, workcell, mapping).columns
  )

  const [error, setError] = useState('')

  const [reading, setReading] = useState(false)

  const generation = useRef(0)

  const workcellKey = JSON.stringify(workcell)

  useEffect(() => {
    setPreview(null)
  }, [mapping, workcellKey])

  useEffect(
    () => () => {
      generation.current++
    },
    []
  )

  const actuated = workcell.bodies.filter((body) => body.joint.kind !== 'fixed')

  const inspect = (nextText = text, nextKind = kind, nextMapping = mapping) => {
    const next =
      nextKind === 'csv'
        ? previewTrajectoryCsv(nextText, workcell, nextMapping)
        : previewTrajectoryJson(nextText, workcell)

    setPreview(next)

    setColumns(next.columns)

    return next
  }

  const load = async (file: File, nextKind: 'csv' | 'json') => {
    const token = ++generation.current

    setError('')

    setPreview(null)

    setReading(false)

    const limit =
      nextKind === 'csv'
        ? TRAJECTORY_IMPORT_LIMITS.csvBytes
        : TRAJECTORY_IMPORT_LIMITS.jsonBytes

    if (file.size > limit) {
      setError(
        `Trajectory ${nextKind.toUpperCase()} exceeds the ${limit / 1024 / 1024} MiB import limit.`
      )

      return
    }

    setReading(true)

    let nextText: string

    try {
      nextText = await file.text()
    } catch (reason) {
      if (token === generation.current) setError(String(reason))

      return
    } finally {
      if (token === generation.current) setReading(false)
    }

    if (token !== generation.current) return

    setText(nextText)

    setKind(nextKind)

    setPreview(null)

    if (nextKind === 'csv') {
      const columns = previewTrajectoryCsv(
        nextText,
        workcell,
        canonicalCsvMapping(workcell)
      ).columns

      setColumns(columns)

      setMapping(guessCsvMapping(columns, workcell))
    }
  }

  const setJointMapping = (
    id: string,
    value: TrajectoryCsvMapping['joints'][string]
  ) =>
    setMapping((current) => ({
      ...current,
      joints: { ...current.joints, [id]: value }
    }))

  return {
    kind,
    text,
    setText,
    mapping,
    setMapping,
    preview,
    setPreview,
    columns,
    error,
    setError,
    reading,
    setReading,
    generation,
    actuated,
    inspect,
    load,
    setJointMapping
  }
}
