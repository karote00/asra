import React, { useState, useEffect, useRef } from 'react'
import { useEventStream } from '../hooks/useEventStream'
import { COLUMN_WIDTH } from '../constants'
import { realSize } from '../utils'

const EVENT_COLOR_MAP: Record<string, string> = {
  decideTo: 'bg-indigo-900',
  request: 'bg-indigo-800',

  startSession: 'bg-blue-900',
  endSession: 'bg-blue-800',

  startTransaction: 'bg-purple-900',
  endTransaction: 'bg-purple-800',

  finish: 'bg-green-900',
  emit: 'bg-green-800',
  core: 'bg-green-700',

  update: 'bg-yellow-900',
  change: 'bg-yellow-900'
}

const getEventColor = (eventType: string): string => {
  for (const prefix in EVENT_COLOR_MAP) {
    if (eventType.startsWith(prefix)) {
      return EVENT_COLOR_MAP[prefix]
    }
  }
  return 'bg-gray-700'
}

export const DebugTimeline: React.FC = () => {
  const events = useEventStream()
  const [filter, setFilter] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(true)

  const [size, setSize] = useState({
    width: realSize(COLUMN_WIDTH),
    height: window.innerHeight / 2
  })
  const isResizing = useRef(false)
  const initialPos = useRef({ x: 0, y: 0 })
  const initialSize = useRef({ width: 0, height: 0 })

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isResizing.current = true
    initialPos.current = { x: e.clientX, y: e.clientY }
    initialSize.current = size
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing.current) {
        const dx = e.clientX - initialPos.current.x
        const dy = e.clientY - initialPos.current.y
        setSize({
          width: initialSize.current.width - dx,
          height: initialSize.current.height - dy
        })
      }
    }

    const handleMouseUp = () => {
      isResizing.current = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const filteredEvents = events.filter((event) =>
    event.type.toLowerCase().includes(filter.toLowerCase())
  )

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  if (isCollapsed) {
    return (
      <div
        className={`fixed bottom-0 right-0 bg-gray-800 text-white p-4 rounded-tl-lg shadow-lg z-50 w-${COLUMN_WIDTH}`}
      >
        <button onClick={() => setIsCollapsed(false)}>Event Stream</button>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-0 right-0 bg-gray-800 text-white p-4 rounded-tl-lg shadow-lg flex flex-col z-50"
      style={{ width: size.width, height: size.height }}
    >
      <div
        className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize bg-gray-600"
        onMouseDown={handleMouseDown}
      />
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Event Stream</h2>
        <button onClick={() => setIsCollapsed(true)} className="text-white">
          Collapse
        </button>
      </div>
      <input
        type="text"
        placeholder="Filter events..."
        className="bg-gray-700 text-white p-2 rounded mb-4"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="overflow-y-auto h-full">
        {filteredEvents.map((event, index) => (
          <div
            key={index}
            className={`p-2 border-b border-gray-700 cursor-pointer ${getEventColor(
              event.type
            )}`}
            onClick={() =>
              setSelectedEvent(selectedEvent === index ? null : index)
            }
          >
            <p>{event.type}</p>
            {selectedEvent === index && (
              <pre className="bg-gray-900 p-2 rounded mt-2 text-xs overflow-auto">
                {JSON.stringify(event, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
