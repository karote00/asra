import React, { ChangeEvent, useState, useCallback, useEffect } from 'react'
import { MIXED_STRING } from '@asra/utils'
import { Text } from '../Text'

// InputProps Interface
interface InputProps {
  /** Content inside the input */
  value?: number | string | typeof MIXED_STRING
  /** Placeholder text inside the input */
  placeholder?: string
  /** Whether the input is disabled */
  disabled?: boolean
  /** Prefix element (e.g., currency symbol) */
  prefix?: string
  /** Suffix element (e.g., measurement unit) */
  suffix?: string
  /** Input size: small, medium, or large */
  size?: 'small' | 'medium' | 'large'
}

const sizeClasses = {
  small: 'h-4 text-sm',
  medium: 'h-6 text-base',
  large: 'h-8 text-lg'
}

const Input: React.FC<InputProps> = ({
  value,
  placeholder = 'Enter text...',
  disabled = false,
  prefix,
  suffix,
  size = 'medium'
}) => {
  const [data, setData] = useState<string>(value?.toString() ?? '')

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newData = e.target.value
    setData(newData)
  }, [])

  useEffect(() => {
    setData(value?.toString() ?? '')
  }, [value])

  return (
    <div
      className={`group flex items-center transition-colors rounded focus-within:ring-1 focus-within:ring-inset focus-within:ring-blue-400
      bg-transparent text-white ${sizeClasses[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {prefix && (
        <div className="w-6 text-center">
          <Text label={prefix} classNames="text-gray-400" />
        </div>
      )}
      <input
        type="text"
        value={data}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className="bg-transparent w-full px-1 outline-none placeholder-gray-500"
      />
      {suffix && (
        <div className="w-6 text-center">
          <Text label={suffix} classNames="text-gray-400" />
        </div>
      )}
    </div>
  )
}

export default Input
