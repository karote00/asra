import React from 'react'

// TextProps Interface
export interface TextProps {
  /** Whether the button is disabled */
  disabled?: boolean
  /** Content inside the button */
  children: string
}

// Text Component
const Text: React.FC<TextProps> = ({ children }) => {
  return <span className="text-gray-200">{children}</span>
}

export default Text
