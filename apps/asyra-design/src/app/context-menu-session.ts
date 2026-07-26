import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ContextMenuDismissReason,
  ContextMenuViewport
} from '@asyra/design-system'
import type { CanvasContextMenuInvocation } from '../render-app'

export interface AppContextMenuSession extends CanvasContextMenuInvocation {
  viewport: ContextMenuViewport
}

export type AppContextMenuSessionDismissReason =
  | ContextMenuDismissReason
  | 'activation'
  | 'activation-without-focus-restore'
  | 'teardown'

export interface AppContextMenuSessionController {
  session: AppContextMenuSession | null
  open: (invocation: CanvasContextMenuInvocation) => void
  dismiss: (reason: AppContextMenuSessionDismissReason) => void
}

const getWindowViewport = (): ContextMenuViewport => ({
  left: 0,
  top: 0,
  width: window.innerWidth,
  height: window.innerHeight
})

const shouldRestoreInvokerFocus = (
  reason: AppContextMenuSessionDismissReason
) =>
  reason !== 'tab' &&
  reason !== 'teardown' &&
  reason !== 'activation-without-focus-restore'

export const useAppContextMenuSession = (
  getViewport: () => ContextMenuViewport = getWindowViewport
): AppContextMenuSessionController => {
  const [session, setSession] = useState<AppContextMenuSession | null>(null)
  const sessionRef = useRef<AppContextMenuSession | null>(null)

  const open = useCallback(
    (invocation: CanvasContextMenuInvocation) => {
      const nextSession = {
        ...invocation,
        viewport: getViewport()
      }
      sessionRef.current = nextSession
      setSession(nextSession)
    },
    [getViewport]
  )

  const dismiss = useCallback((reason: AppContextMenuSessionDismissReason) => {
    const currentSession = sessionRef.current
    if (!currentSession) return

    sessionRef.current = null
    setSession(null)

    if (!shouldRestoreInvokerFocus(reason)) return

    queueMicrotask(() => {
      if (currentSession.invoker.isConnected) {
        currentSession.invoker.focus({ preventScroll: true })
      }
    })
  }, [])

  useEffect(
    () => () => {
      sessionRef.current = null
    },
    []
  )

  return {
    session,
    open,
    dismiss
  }
}
