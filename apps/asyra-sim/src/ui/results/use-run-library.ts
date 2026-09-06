import { useEffect, useRef, useState } from 'react'
import { type RunComparison } from '../../storage/run-comparison'
import type { RunRecord } from '../../storage/run-record'
import {
  exportRunCsv,
  exportRunHtml,
  exportRunJson
} from '../../storage/run-reports'
import { downloadText } from '../projects/download-project'
import { errorMessage } from '../shared/error-message'

export function useRunLibrary({
  runs,
  onRetain
}: {
  runs: readonly RunRecord[]
  onRetain: (run: RunRecord) => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  const [selectedId, setSelectedId] = useState(runs.at(-1)?.result.runId ?? '')

  const [comparisonIds, setComparisonIds] = useState<string[]>([])

  const [comparison, setComparison] = useState<RunComparison | null>(null)

  const [error, setError] = useState('')

  const [saving, setSaving] = useState(false)

  const [page, setPage] = useState(0)

  useEffect(() => {
    const element = dialog.current

    element?.showModal()

    return () => element?.close()
  }, [])

  const selected = runs.find((run) => run.result.runId === selectedId)

  const pages = Math.max(1, Math.ceil(runs.length / 30))

  const currentPage = Math.min(page, pages - 1)

  const exportReport = (format: 'json' | 'csv' | 'html') => {
    if (!selected) return

    try {
      const text = {
        json: exportRunJson,
        csv: exportRunCsv,
        html: exportRunHtml
      }[format](selected)

      downloadText(
        `sim-${selected.result.runId}.${format}`,
        text,
        {
          json: 'application/json',
          csv: 'text/csv;charset=utf-8',
          html: 'text/html;charset=utf-8'
        }[format]
      )

      setError('')
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  const retainSelected = async () => {
    if (!selected) return

    setSaving(true)

    try {
      await onRetain(selected)

      setError('')
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  return {
    dialog,
    selectedId,
    setSelectedId,
    comparisonIds,
    setComparisonIds,
    comparison,
    setComparison,
    error,
    setError,
    saving,
    setSaving,
    setPage,
    selected,
    pages,
    currentPage,
    exportReport,
    retainSelected
  }
}
