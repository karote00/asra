import React from 'react'

// TextProps Interface
export interface TextProps {
  /** Whether the text is disabled */
  disabled?: boolean
  /** Content inside the button */
  label: string
  /** Content inside the button */
  classNames?: string
}

// Text Component
const Text: React.FC<TextProps> = ({ label, classNames = 'text-gray-200' }) => {
  return <span className={classNames}>{label}</span>
}

export default Text
