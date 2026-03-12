import { type FillGradientType } from '@asyra/utils'

interface GradientTypeControlsProps {
  index: number
  value: FillGradientType
  options: FillGradientType[]
  onChange: (nextType: FillGradientType) => void
  onFlip: () => void
}

const FlipIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    className="h-3.5 w-3.5"
    fill="none"
  >
    <path
      d="M3 5.25h7.5M8.5 2.75l2.5 2.5-2.5 2.5M13 10.75H5.5M7.5 8.25l-2.5 2.5 2.5 2.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const GradientTypeControls = ({
  index,
  value,
  options,
  onChange,
  onFlip
}: GradientTypeControlsProps) => (
  <div className="flex items-center gap-2">
    <div className="flex flex-1 items-center gap-2">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as FillGradientType)}
        className="min-w-24 flex-1 rounded-md border border-[#3a3a3a] bg-transparent px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-[#ccc] outline-none transition-colors hover:border-[#555] focus:border-[#0d99ff]"
        data-testid={`prop-fill-gradient-type-${index}`}
      >
        {options.map((gradientType) => (
          <option key={gradientType} value={gradientType}>
            {gradientType}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onFlip}
        className="icon-btn"
        data-testid={`prop-fill-gradient-flip-${index}`}
        aria-label="Flip gradient"
        title="Flip gradient"
      >
        <FlipIcon />
      </button>
    </div>
  </div>
)

export default GradientTypeControls
