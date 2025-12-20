import React from 'react'

export const DebugTimeline: React.FC = () => {
  return (
    <div className="fixed bottom-4 right-4 w-96 h-1/2 bg-gray-800 text-white p-4 rounded-lg shadow-lg">
      <h2 className="text-lg font-bold mb-4">Event Stream</h2>
      <div className="overflow-y-auto h-full">
        {/* Events will be listed here */}
        <p>Coming soon...</p>
      </div>
    </div>
  )
}
