import React, { useState, useEffect } from 'react'
import {
  subscribeToEvents,
  AllEvent
} from '@asra/reactive-events'

export const DebugTimeline: React.FC = () => {
  const [events, setEvents] = useState<AllEvent[]>([])

  useEffect(() => {
    const subscription = subscribeToEvents((event) => {
      setEvents((prevEvents) => [event, ...prevEvents])
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="fixed bottom-4 right-4 w-96 h-1/2 bg-gray-800 text-white p-4 rounded-lg shadow-lg">
      <h2 className="text-lg font-bold mb-4">Event Stream</h2>
      <div className="overflow-y-auto h-full">
        {events.map((event, index) => (
          <div key={index} className="p-2 border-b border-gray-700">
            <p>{event.type}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
