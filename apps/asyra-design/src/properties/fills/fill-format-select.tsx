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
    <select
      id={`fill-format-${index}`}
      value={value}
      onChange={(event) => onChange(event.target.value as FillColorFormat)}
      className="w-full rounded-md border border-[#3a3a3a] bg-transparent px-2 py-1.5 text-[11px] text-[#ccc] outline-none transition-colors hover:border-[#555] focus:border-[#0d99ff]"
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
