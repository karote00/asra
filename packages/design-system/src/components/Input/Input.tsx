import React, {
  ChangeEvent,
  useState,
  useCallback,
  useEffect,
  KeyboardEvent,
  useRef
} from 'react'
import { MIXED_STRING } from '@asyra/utils'

// InputProps Interface
interface InputProps extends Omit<
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
  onChange: (newData: string) => boolean | undefined
  /** Additional class name for the container div */
  containerClassName?: string
  /** Additional styles for the container div */
  containerStyle?: React.CSSProperties
  /** Whether to hide the outline rings on hover and focus */
  noOutline?: boolean
  /** Additional class name for the internal input element */
  inputClassName?: string
}

const sizeClasses = {
  small: 'text-[10px]',
  medium: 'text-[11px]',
  large: 'text-[12px]'
}

const Input: React.FC<InputProps> = ({
  value,
  placeholder = '',
  disabled = false,
  prefix,
  suffix,
  size = 'medium',
  onChange,
  containerClassName,
  containerStyle,
  noOutline = false,
  inputClassName,
  ...rest
}) => {
  const inputRef = useRef(null)
  const [data, setData] = useState<string>(value?.toString() ?? '')

  const handleKeydon = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation()

      if (!inputRef.current) {
        return
      }

      const input = inputRef.current as HTMLInputElement
      if (e.code === 'Enter') {
        e.preventDefault()
        input.blur()
      }
    },
    [inputRef]
  )

  const handleKeyup = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
  }, [])

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newData = e.target.value
      setData(newData)
    },
    [setData]
  )

  const handleBlur = useCallback(() => {
    const accepted = onChange(data)
    if (accepted === false) {
      setData(value?.toString() ?? '')
    }
  }, [data, onChange, value])

  useEffect(() => {
    setData(value?.toString() ?? '')
  }, [value])

  return (
    <div
      className={`group flex items-center h-full bg-transparent transition-all
      ${!noOutline ? 'hover:ring-1 hover:ring-border-hover focus-within:ring-1 focus-within:ring-border-focus' : ''}
      ${sizeClasses[size]} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${containerClassName ?? 'rounded'}`}
      style={containerStyle}
    >
      {prefix && (
        <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
          <span className="text-[10px] font-medium text-white">{prefix}</span>
        </div>
      )}
      <input
        type="text"
        ref={inputRef}
        value={data}
        onKeyDown={handleKeydon}
        onKeyUp={handleKeyup}
        onChange={handleChange}
        onBlur={(e) => {
          handleBlur()
        }}
        onFocus={(e) => {
          e.currentTarget.select()
        }}
        placeholder={placeholder}
        disabled={disabled}
        {...rest}
        className={`bg-transparent w-full h-full pr-1 outline-none text-text-primary caret-accent text-[11px] ${!prefix ? 'pl-2' : ''} ${inputClassName ?? ''}`}
      />
      {suffix && (
        <div className="pr-1.5 flex-shrink-0">
          <span className="text-[10px] text-white">{suffix}</span>
        </div>
      )}
    </div>
  )
}

export default Input
