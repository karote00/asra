import { useEffect, useMemo, useRef, useState } from 'react'
import { version as appVersion } from '../../../package.json'
import type {
  ExperimentSnapshot,
  PreflightReport
} from '../../analysis/contracts'
import type { ExperimentDraft } from '../../common-apis/experiment'
import { jointValuesAt, type Workcell } from '../../domain/workcell'
import type { SimRuntime } from '../../init/bootstrap'
import type { RunRecord } from '../../storage/run-record'
import {
  createDefaultExperimentDraft,
  definitionToDraft,
  formatExclusions,
  parseExclusions
} from './experiment-draft'
import type { PlaybackView } from './playback-view'

type Perform = (
  action: (assertCurrent: () => void) => Promise<unknown>,
  message: string
) => Promise<void>

export function useExperimentController({
  runtime,
  candidateId,
  workcell,
  revision,
  perform,
  onPlayback,
  runs,
  onRun
}: {
  runtime: SimRuntime
  candidateId: string
  workcell: Workcell
  revision: number
  perform: Perform
  onPlayback: (value: PlaybackView | null) => void
  runs: readonly RunRecord[]
  onRun: (run: RunRecord) => void
}) {
  const experiments = useMemo(
    () => runtime.getExperiments(candidateId),
    [runtime, candidateId, revision]
  )

  const [experimentId, setExperimentId] = useState(experiments[0]?.id ?? '')

  const canonical = experiments.find((item) => item.id === experimentId) ?? null

  const methods = runtime.getMethodDescriptors()

  const [name, setName] = useState('New clearance study')

  const [draft, setDraft] = useState<ExperimentDraft>(() =>
    canonical
      ? definitionToDraft(canonical.definition)
      : createDefaultExperimentDraft(workcell)
  )

  const [exclusions, setExclusions] = useState(() =>
    formatExclusions(draft.scope.excludedPairs)
  )

  const [preflight, setPreflight] = useState<PreflightReport | null>(null)

  const [warnings, setWarnings] = useState<string[]>([])

  const [running, setRunning] = useState(false)

  const [runningInput, setRunningInput] = useState<ExperimentSnapshot | null>(
    null
  )

  const [error, setError] = useState('')

  const live = useRef(true)

  const active = useRef<AbortController | null>(null)

  const canonicalDraft = useMemo(
    () => (canonical ? definitionToDraft(canonical.definition) : null),
    [canonical]
  )

  const canonicalKey = useMemo(
    () => JSON.stringify(canonicalDraft),
    [canonicalDraft]
  )

  useEffect(() => {
    live.current = true

    return () => {
      live.current = false

      active.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (canonical) {
      setDraft(definitionToDraft(canonical.definition))

      setExclusions(formatExclusions(canonical.definition.scope.excludedPairs))
    }

    setPreflight(null)

    setWarnings([])

    setError('')

    onPlayback(null)
  }, [experimentId, canonicalKey, onPlayback])

  useEffect(() => {
    setPreflight(null)

    setWarnings([])

    onPlayback(null)
  }, [revision, onPlayback])

  const changed = (next: ExperimentDraft) => {
    setDraft(next)

    setPreflight(null)

    setWarnings([])

    onPlayback(null)
  }

  let dirty = !canonical

  try {
    dirty ||=
      JSON.stringify({
        ...draft,
        scope: { ...draft.scope, excludedPairs: parseExclusions(exclusions) }
      }) !== canonicalKey
  } catch {
    dirty = true
  }

  const fail = (reason: unknown) => {
    if (live.current)
      setError(reason instanceof Error ? reason.message : String(reason))
  }

  const save = async () => {
    try {
      const next = {
        ...draft,
        scope: { ...draft.scope, excludedPairs: parseExclusions(exclusions) }
      }

      await perform(async (assertCurrent) => {
        if (canonical)
          await runtime.features.edit.updateExperiment(
            canonical.id,
            canonical.definition.revision,
            next
          )
        else {
          const id = await runtime.features.edit.createExperiment(
            candidateId,
            name,
            next
          )

          assertCurrent()

          if (live.current) setExperimentId(id)
        }

        assertCurrent()
      }, 'Experiment saved - one Undo action')

      if (live.current) setError('')
    } catch (reason) {
      fail(reason)
    }
  }

  const freshDraft = () => {
    setExperimentId('')

    const next = createDefaultExperimentDraft(workcell)

    setDraft(next)

    setExclusions('')

    setName('New clearance study')

    setPreflight(null)
  }

  const inspect = () => {
    if (!canonical || dirty)
      throw new Error('Save the experiment draft before preflight.')

    const report = runtime.preflightExperiment(canonical.id)

    setPreflight(report)

    return report
  }

  const replayCurrent = (value: number) => {
    if (!canonical) return

    try {
      const joints = jointValuesAt(canonical.definition.trajectory, value)

      onPlayback({
        workcell,
        joints,
        time: value,
        historical: false,
        bodyIds: []
      })
    } catch (reason) {
      fail(reason)
    }
  }

  const replayRun = (
    snapshot: ExperimentSnapshot,
    value: number,
    bodyIds: readonly string[]
  ) => {
    onPlayback({
      workcell: snapshot.workcell,
      joints: jointValuesAt(snapshot.trajectory, value),
      time: value,
      historical: true,
      bodyIds
    })
  }

  const run = async () => {
    try {
      inspect()

      if (!canonical) return

      const snapshot = runtime.createExperimentSnapshot(canonical.id, warnings)

      const lineage = runtime.getCandidateLineage(candidateId)

      const candidateName =
        runtime
          .getCandidates()
          .find((candidate) => candidate.id === candidateId)?.name ??
        candidateId

      const runName = `${candidateName.slice(0, 60)} - ${canonical.name.slice(0, 90)} - r${canonical.definition.revision}`

      const controller = new AbortController()

      const environment = {
        appVersion,
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency
      }

      active.current = controller

      setRunning(true)

      setRunningInput(snapshot)

      setError('')

      const result = await runtime.features.analysis.run(snapshot, {
        signal: controller.signal
      })

      if (live.current)
        onRun({
          version: 1,
          name: runName,
          retainedAt: new Date().toISOString(),
          environment,
          snapshot,
          result,
          ...(lineage ? { lineage } : {})
        })
    } catch (reason) {
      fail(reason)
    } finally {
      if (live.current) {
        setRunning(false)

        setRunningInput(null)
      }

      active.current = null
    }
  }

  const selectedRun = [...runs]
    .reverse()
    .find((item) => item.snapshot.source.experimentId === experimentId)

  const retainSelectedRun = () =>
    selectedRun &&
    void perform(
      () => runtime.features.storage.retain(selectedRun),
      'Result retained - save the project for durable storage'
    )

  return {
    methods,
    canonicalDraft,
    experiments,
    experimentId,
    setExperimentId,
    canonical,
    name,
    setName,
    draft,
    exclusions,
    setExclusions,
    preflight,
    setPreflight,
    warnings,
    setWarnings,
    running,
    runningInput,
    error,
    setError,
    active,
    canonicalKey,
    changed,
    dirty,
    fail,
    save,
    freshDraft,
    inspect,
    replayCurrent,
    replayRun,
    run,
    selectedRun,
    retainSelectedRun
  }
}
