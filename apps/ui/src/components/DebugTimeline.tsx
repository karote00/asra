import React, { useState } from 'react'
import { useEventStream } from '../hooks/useEventStream'

const getEventColor = (eventType: string): string => {
  if (eventType.startsWith('DECIDE_TO')) return 'bg-blue-900'
  if (eventType.includes('SESSION')) return 'bg-blue-800'
  if (eventType.startsWith('FINISH_')) return 'bg-green-900'
  if (eventType.startsWith('EMIT_')) return 'bg-green-800'
  if (eventType.startsWith('CORE_')) return 'bg-green-700'
  if (eventType.startsWith('UPDATE_')) return 'bg-yellow-900'
  if (eventType.startsWith('REQUEST_')) return 'bg-yellow-800'
  return 'bg-gray-700'
}

export const DebugTimeline: React.FC = () => {
  const events = useEventStream()
  const [filter, setFilter] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const filteredEvents = events.filter((event) =>
    event.type.toLowerCase().includes(filter.toLowerCase())
  )

  if (isCollapsed) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg z-50 pointer-events-none">
        <button onClick={() => setIsCollapsed(false)}>Event Stream</button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-1/2 bg-gray-800 text-white p-4 rounded-lg shadow-lg flex flex-col z-50 pointer-events-none">
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
