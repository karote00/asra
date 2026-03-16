import React from 'react'

interface ColorPickerInputGroupProps {
  colorFormat: string
  formatOptions: string[]
  onFormatChange?: (format: string) => void
  values: string[]
  onChange: (value: string, index: number) => void
  onBlur: (index: number) => void
  showAlpha?: boolean
  'data-testid'?: string
}

const Divider = () => <div className="w-[1px] h-3 bg-white/[0.08] shrink-0" />

export const ColorPickerInputGroup: React.FC<ColorPickerInputGroupProps> = (
  props
) => {
  const {
    colorFormat,
    formatOptions,
    onFormatChange,
    values,
    onChange,
    onBlur,
    showAlpha,
    'data-testid': dataTestId
  } = props

  return (
    <div className="px-3 flex items-center gap-2">
      <div className="w-[66px] h-6 flex items-center rounded-[3px] bg-panel-surface-hover border border-transparent hover:border-[#5c5c5c] transition-all overflow-hidden text-white">
        <select
          value={colorFormat}
          onChange={(e) => onFormatChange?.(e.target.value)}
          className="!pr-4 !pl-1 w-full bg-transparent text-[11px] text-white outline-none appearance-none cursor-pointer uppercase shrink-0 h-full"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='4' viewBox='0 0 6 4' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1.5 1L3 2.5L4.5 1' stroke='white' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundPosition: 'right 4px center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {formatOptions.map((opt) => (
            <option key={opt} value={opt} className="bg-[#1f2022] text-white">
              {opt.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 flex items-center h-6 rounded-[3px] bg-panel-surface-hover border border-transparent hover:border-[#5c5c5c] focus-within:border-border-focus transition-all overflow-hidden text-white">
        <div className="flex-1 flex items-center min-w-0 h-full">
          {values.map((val, i) => (
            <React.Fragment key={i}>
              <div className="flex-1 min-w-0 flex items-center h-full">
                <input
                  type="text"
                  value={val}
                  onChange={(e) => onChange(e.target.value, i)}
                  onBlur={() => onBlur(i)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      onBlur(i)
                      ;(e.target as HTMLInputElement).blur()
                    }
                  }}
                  className={`bg-transparent text-[11px] text-white outline-none text-center h-full flex-1 min-w-0 ${
                    colorFormat === 'hex' && i === 0 ? 'uppercase' : ''
                  } ${colorFormat === 'css' ? 'px-2' : ''}`}
                  data-testid={
                    dataTestId
                      ? showAlpha && i === values.length - 1
                        ? `${dataTestId}-opacity`
                        : colorFormat === 'hex' && i === 0
                          ? `${dataTestId}-hex`
                          : undefined
                      : undefined
                  }
                />
                {showAlpha && i === values.length - 1 && (
                  <span className="pr-1 text-[10px] text-white">%</span>
                )}
              </div>
              {i < values.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
