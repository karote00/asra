import React, { useCallback, useMemo } from 'react'
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
import type { GroupCommandPlatform } from '../constants'
import { deriveGroupCommandState } from '../controllers/group-commands'
import {
  useElementDataMap,
  useElementSelection,
  useFlattenedIdsData
} from '../providers'
import { useAppContextMenuSession } from './context-menu-session'
import { GroupContextMenu } from './group-context-menu'

interface AppProps {
  groupCommandPlatform?: GroupCommandPlatform
}

const App: React.FC<AppProps> = ({
  groupCommandPlatform = detectGroupCommandPlatform()
}) => {
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
  const handleCanvasHostTeardown = useCallback(
    () => contextMenu.dismiss('teardown'),
    [contextMenu.dismiss]
  )

  return (
    <div
      className="absolute grid h-screen w-full z-20"
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
        descriptors={groupCommandDescriptors}
        onDismiss={contextMenu.dismiss}
      />
      <ToolBar />
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
