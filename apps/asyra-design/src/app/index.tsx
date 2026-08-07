import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ToolBar from '../toolbar'
import Contents from '../contents'
import Properties from '../properties'
import Animation from '../animation'
import { toTailwindPixelSize } from '../tailwind-size'
import { COLUMN_WIDTH } from '../constants'
import RenderApp from '../render-app'
import {
  createGroupCommandDescriptors,
  detectGroupCommandPlatform
} from '../config/group-command-descriptors'
import {
  createAiPanelCommandDescriptor,
  matchesAiPanelToggleShortcut
} from '../config/ai-panel-command'
import type { GroupCommandPlatform } from '../constants'
import { deriveGroupCommandState } from '../controllers/group-commands'
import {
  useElementDataMap,
  useElementSelection,
  useFlattenedIdsData
} from '../providers'
import { useAppContextMenuSession } from './context-menu-session'
import { GroupContextMenu } from './group-context-menu'
import { AiConversationPanel } from './ai-conversation-panel'
import { AiHistoryMessageBar } from './ai-history-message-bar'
import type { AiConfirmationBroker } from '../ai/confirmation'
import type { AiConversationController } from '../ai/conversation'
import type { AiHistoryProjection } from '../common-apis/history'

interface AppProps {
  ai: {
    readonly confirmation: AiConfirmationBroker
    readonly conversation: AiConversationController
    readonly history: AiHistoryProjection
  }
  groupCommandPlatform?: GroupCommandPlatform
}

const App: React.FC<AppProps> = ({
  ai,
  groupCommandPlatform = detectGroupCommandPlatform()
}) => {
  const appRootRef = useRef<HTMLDivElement>(null)
  const aiFocusReturnRef = useRef<HTMLElement | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const contextMenu = useAppContextMenuSession()
  const elementSelection = useElementSelection()
  const flattenedIds = useFlattenedIdsData()
  const elementDataMap = useElementDataMap()
  const groupCommandState = useMemo(
    () =>
      deriveGroupCommandState(
        [...elementSelection],
        flattenedIds,
        elementDataMap
      ),
    [elementDataMap, elementSelection, flattenedIds]
  )
  const groupCommandDescriptors = useMemo(
    () =>
      createGroupCommandDescriptors({
        platform: groupCommandPlatform,
        state: groupCommandState
      }),
    [groupCommandPlatform, groupCommandState]
  )
  const getCanvasHost = useCallback(
    () =>
      appRootRef.current?.querySelector<HTMLElement>(
        '[data-testid="canvas-host"]'
      ) ?? null,
    []
  )
  const focusAfterPanelClose = useCallback(
    (preferredTarget?: HTMLElement | null) => {
      const promptTriggered = Boolean(
        preferredTarget?.closest('[data-ai-agent-prompt="true"]')
      )
      let target = getCanvasHost()
      if (aiFocusReturnRef.current?.isConnected) {
        target = aiFocusReturnRef.current
      }
      if (!promptTriggered && preferredTarget?.isConnected) {
        target = preferredTarget
      }

      queueMicrotask(() => {
        if (target?.isConnected) {
          target.focus({ preventScroll: true })
        }
      })
    },
    [getCanvasHost]
  )
  const closeAiPanel = useCallback(
    ({
      cancelActive,
      focusTarget
    }: {
      cancelActive: boolean
      focusTarget?: HTMLElement | null
    }) => {
      if (cancelActive && ai.conversation.getSnapshot().activeTurn) {
        ai.conversation.cancel('panel-closed')
      }
      setAiOpen(false)
      focusAfterPanelClose(focusTarget)
    },
    [ai, focusAfterPanelClose]
  )
  const toggleAiPanel = useCallback(
    (invoker: HTMLElement | null) => {
      if (aiOpen) {
        closeAiPanel({ cancelActive: true, focusTarget: invoker })
        return
      }

      aiFocusReturnRef.current =
        invoker?.isConnected === true ? invoker : getCanvasHost()
      setAiOpen(true)
    },
    [aiOpen, closeAiPanel, getCanvasHost]
  )
  const aiPanelCommandDescriptor = useMemo(
    () =>
      createAiPanelCommandDescriptor({
        platform: groupCommandPlatform,
        execute: () =>
          toggleAiPanel(contextMenu.session?.invoker ?? getCanvasHost())
      }),
    [
      ai,
      contextMenu.session?.invoker,
      getCanvasHost,
      groupCommandPlatform,
      toggleAiPanel
    ]
  )
  const contextMenuDescriptors = useMemo(
    () => [aiPanelCommandDescriptor, ...groupCommandDescriptors],
    [aiPanelCommandDescriptor, groupCommandDescriptors]
  )
  useEffect(() => {
    const handleAgentPanelShortcut = (event: KeyboardEvent) => {
      if (!matchesAiPanelToggleShortcut(event, groupCommandPlatform)) return

      const root = appRootRef.current
      const eventTarget =
        event.target instanceof HTMLElement ? event.target : null
      const targetIsDocumentBody = eventTarget === document.body
      if (
        !root ||
        (eventTarget && !targetIsDocumentBody && !root.contains(eventTarget)) ||
        (targetIsDocumentBody &&
          document.querySelectorAll('[data-ai-root="true"]').length !== 1)
      ) {
        return
      }

      const activeElement =
        document.activeElement instanceof HTMLElement &&
        root.contains(document.activeElement)
          ? document.activeElement
          : null
      const invoker =
        eventTarget && !targetIsDocumentBody
          ? eventTarget
          : (activeElement ?? getCanvasHost())

      event.preventDefault()
      event.stopPropagation()
      toggleAiPanel(invoker)
    }

    window.addEventListener('keydown', handleAgentPanelShortcut)
    return () => window.removeEventListener('keydown', handleAgentPanelShortcut)
  }, [ai, getCanvasHost, groupCommandPlatform, toggleAiPanel])
  const handleCanvasHostTeardown = useCallback(
    () => contextMenu.dismiss('teardown'),
    [contextMenu.dismiss]
  )

  return (
    <div
      ref={appRootRef}
      className="absolute grid h-screen w-full z-20"
      data-ai-root="true"
      style={{
        gridTemplateAreas: `
        "header header header"
        "left-sidebar canvas right-sidebar"
        "footer footer footer"
      `,
        gridTemplateColumns: `${toTailwindPixelSize(
          COLUMN_WIDTH
        )}px 1fr ${toTailwindPixelSize(COLUMN_WIDTH)}px`,
        gridTemplateRows: 'auto 1fr auto'
      }}
    >
      <RenderApp
        onContextMenuRequest={contextMenu.open}
        onCanvasHostTeardown={handleCanvasHostTeardown}
      />
      <GroupContextMenu
        session={contextMenu.session}
        descriptors={contextMenuDescriptors}
        onDismiss={contextMenu.dismiss}
      />
      <ToolBar
        aiOpen={aiOpen}
        aiShortcutLabel={aiPanelCommandDescriptor.shortcutLabel}
        onAiToggle={toggleAiPanel}
      />
      {aiOpen ? (
        <AiConversationPanel
          confirmation={ai.confirmation}
          conversation={ai.conversation}
          onClose={() =>
            closeAiPanel({
              cancelActive: false
            })
          }
        />
      ) : null}
      <AiHistoryMessageBar
        conversation={ai.conversation}
        history={ai.history}
      />
      <Contents />
      <Properties />
      <Animation />
      <div
        id="viewport-anchor"
        className="absolute inset-0 pointer-events-none"
        style={{ gridArea: 'canvas' }}
      />
    </div>
  )
}

export default App
