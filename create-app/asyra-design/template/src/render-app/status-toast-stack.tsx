import React, { useCallback, useEffect, useRef, useState } from 'react'

export const STATUS_TOAST_AUTO_DISMISS_MS = 10_000
export const STATUS_TOAST_EXIT_MS = 200

export interface StatusToastDescriptor {
  readonly id: string
  readonly message: string
}

interface StatusToastEntry extends StatusToastDescriptor {
  readonly autoDismissAt: number
  readonly state: 'open' | 'closing'
}

interface StatusToastStackProps {
  readonly toasts: readonly StatusToastDescriptor[]
}

const createToastEntry = (toast: StatusToastDescriptor): StatusToastEntry => ({
  ...toast,
  autoDismissAt: Date.now() + STATUS_TOAST_AUTO_DISMISS_MS,
  state: 'open'
})

export const StatusToastStack: React.FC<StatusToastStackProps> = ({
  toasts
}) => {
  const [entries, setEntries] = useState<StatusToastEntry[]>(() =>
    toasts.map(createToastEntry)
  )
  const dismissedWhileActiveRef = useRef(new Set<string>())

  const dismiss = useCallback((toastId: string) => {
    dismissedWhileActiveRef.current.add(toastId)
    setEntries((current) =>
      current.map((entry) =>
        entry.id === toastId && entry.state === 'open'
          ? { ...entry, state: 'closing' }
          : entry
      )
    )
  }, [])

  useEffect(() => {
    const activeIds = new Set(toasts.map(({ id }) => id))
    for (const dismissedId of dismissedWhileActiveRef.current) {
      if (!activeIds.has(dismissedId)) {
        dismissedWhileActiveRef.current.delete(dismissedId)
      }
    }

    setEntries((current) => {
      const entriesById = new Map(current.map((entry) => [entry.id, entry]))
      const nextEntries = current.map((entry) =>
        activeIds.has(entry.id) || entry.state === 'closing'
          ? entry
          : { ...entry, state: 'closing' as const }
      )

      for (const toast of toasts) {
        const existing = entriesById.get(toast.id)
        if (!existing && !dismissedWhileActiveRef.current.has(toast.id)) {
          nextEntries.push(createToastEntry(toast))
        }
      }
      return nextEntries
    })
  }, [toasts])

  useEffect(() => {
    const timeouts = entries
      .filter(({ state }) => state === 'open')
      .map((entry) =>
        window.setTimeout(
          () => dismiss(entry.id),
          Math.max(0, entry.autoDismissAt - Date.now())
        )
      )
    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout))
  }, [dismiss, entries])

  useEffect(() => {
    const timeouts = entries
      .filter(({ state }) => state === 'closing')
      .map((entry) =>
        window.setTimeout(() => {
          setEntries((current) => current.filter(({ id }) => id !== entry.id))
        }, STATUS_TOAST_EXIT_MS)
      )
    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout))
  }, [entries])

  if (entries.length === 0) {
    return null
  }

  return (
    <div
      aria-label="Status notifications"
      className="pointer-events-none absolute left-1/2 top-4 z-50 w-[min(90vw,82rem)] -translate-x-1/2"
    >
      {entries.map((entry, index) => {
        const isClosing = entry.state === 'closing'
        return (
          <div
            data-state={entry.state}
            data-toast-id={entry.id}
            key={entry.id}
            style={{
              display: 'grid',
              gridTemplateRows: isClosing ? '0fr' : '1fr',
              marginBottom: isClosing || index === entries.length - 1 ? 0 : 12,
              opacity: isClosing ? 0 : 1,
              transform: isClosing ? 'translateY(-8px)' : 'translateY(0)',
              transitionDuration: `${STATUS_TOAST_EXIT_MS}ms`,
              transitionProperty:
                'grid-template-rows, margin-bottom, opacity, transform',
              transitionTimingFunction: 'ease-out'
            }}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="pointer-events-auto relative rounded bg-red-700 px-4 py-3 pr-12 text-base text-white shadow">
                <span role="alert">{entry.message}</span>
                <button
                  aria-label={`Close ${entry.message}`}
                  className="absolute right-2 top-2 flex size-7 items-center justify-center rounded text-xl leading-none text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
                  onClick={() => dismiss(entry.id)}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
