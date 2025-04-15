import React from 'react'

// TextProps Interface
export interface TextProps {
  /** Whether the text is disabled */
  disabled?: boolean
  /** Content inside the button */
  label: string | number
  /** Content inside the button */
  classNames?: string
}

// Text Component
const Text: React.FC<TextProps> = ({ label, classNames = 'text-gray-200' }) => {
  const labelContent = typeof label === 'string' ? label : label.toString()
  return <span className={classNames}>{labelContent}</span>
}

export default Text
