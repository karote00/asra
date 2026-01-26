import React, {
  ChangeEvent,
  useState,
  useCallback,
  useEffect,
  KeyboardEvent,
  useRef
} from 'react'
import { MIXED_STRING } from '@asyra/utils'
import { Text } from '../Text'

// InputProps Interface
// InputProps Interface
interface InputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'onChange' | 'size'
  > {
  /** Content inside the input */
  value?: number | string | typeof MIXED_STRING
  /** Prefix element (e.g., currency symbol) */
  prefix?: string
  /** Suffix element (e.g., measurement unit) */
  suffix?: string
  /** Input size: small, medium, or large */
  size?: 'small' | 'medium' | 'large'
  /** Change event handler */
  onChange: (newData: string) => void
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
  size = 'medium',
  onChange,
  ...rest
}) => {
  const inputRef = useRef(null)
  const [data, setData] = useState<string>(value?.toString() ?? '')

  const handleKeydon = useCallback(
    (e: KeyboardEvent) => {
      if (!inputRef.current) {
        return
      }

      const input = inputRef.current as HTMLInputElement
      if (e.code === 'Enter') {
        input.blur()
      }
    },
    [inputRef.current]
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newData = e.target.value
      setData(newData)
    },
    [setData]
  )

  const handleBlur = useCallback(() => {
    onChange(data)
  }, [data, onChange])

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
        ref={inputRef}
        value={data}
        onKeyDown={handleKeydon}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        {...rest}
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
