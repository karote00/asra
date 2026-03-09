import { type FillColorFormat } from '@asyra/utils'
import { ALLOWED_COLOR_FORMATS } from '../../constants'

interface FillFormatSelectProps {
  index: number
  value: FillColorFormat
  onChange: (nextFormat: FillColorFormat) => void
}

const FillFormatSelect = ({
  index,
  value,
  onChange
}: FillFormatSelectProps) => (
  <div className="flex items-center gap-2 w-full">
    <label
      className="text-xs text-gray-400 w-11"
      htmlFor={`fill-format-${index}`}
    >
      Format
    </label>
    <select
      id={`fill-format-${index}`}
      value={value}
      onChange={(event) => onChange(event.target.value as FillColorFormat)}
      className="bg-transparent text-white border border-border-dark rounded px-2 py-1 text-xs flex-1"
      data-testid={`prop-fill-format-${index}`}
    >
      {ALLOWED_COLOR_FORMATS.map((format) => (
        <option key={format} value={format}>
          {format}
        </option>
      ))}
    </select>
  </div>
)

export default FillFormatSelect
