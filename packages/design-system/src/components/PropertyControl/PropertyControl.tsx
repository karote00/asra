import React, { ReactNode } from 'react'

interface PropertyControlProps {
  /** Content of the property control (e.g., an Input) */
  children: ReactNode
  /** Additional classes for the container */
  className?: string
  /** Corner rounding strategy */
  rounded?: 'all' | 'left' | 'right' | 'none'
  /** Manual styles */
  style?: React.CSSProperties
  /** Data test ID */
  'data-testid'?: string
  /** Optional group name to listen for hover/focus states from a parent */
  group?: string
}

/**
 * PropertyControl acts as a standard container for property inputs.
 * It manages hover and focus-within states with coordinated background and ring updates.
 */
const PropertyControl: React.FC<PropertyControlProps> = ({
  children,
  className = '',
  rounded = 'all',
  style,
  group,
  'data-testid': testId
}) => {
  const roundedClasses = {
    all: 'rounded-[3px]',
    left: 'rounded-l-[3px]',
    right: 'rounded-r-[3px]',
    none: 'rounded-none'
  }

  // Base state: transparent background with a transparent border placeholder
  // Hover: #5c5c5c outline via border
  // Focus: Blue outline via border
  const interactionClasses = group
    ? `bg-panel-surface-hover border border-transparent group-hover/${group}:border-[#5c5c5c] group-focus-within/${group}:border-border-focus group-hover/${group}:group-focus-within/${group}:border-border-focus`
    : `bg-panel-surface-hover border border-transparent hover:border-[#5c5c5c] focus-within:border-border-focus hover:focus-within:border-border-focus`

  return (
    <div
      className={`group/prop-control flex items-center h-6 min-w-0 transition-all text-white
      ${interactionClasses}
      ${roundedClasses[rounded]} ${className}`}
      style={style}
      data-testid={testId}
    >
      {children}
    </div>
  )
}

export default PropertyControl
