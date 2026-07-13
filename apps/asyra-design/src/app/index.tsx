import React from 'react'
import ToolBar from '../toolbar'
import Contents from '../contents'
import Properties from '../properties'
import Animation from '../animation'
import { realSize } from '../utils'
import { COLUMN_WIDTH } from '../constants'
import RenderApp from '../render-app'

const App: React.FC = () => {
  return (
    <div
      className="absolute grid h-screen w-full z-20"
      style={{
        gridTemplateAreas: `
        "header header header"
        "left-sidebar canvas right-sidebar"
        "footer footer footer"
      `,
        gridTemplateColumns: `${realSize(COLUMN_WIDTH)}px 1fr ${realSize(
          COLUMN_WIDTH
        )}px`,
        gridTemplateRows: 'auto 1fr auto'
      }}
    >
      <RenderApp />
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
