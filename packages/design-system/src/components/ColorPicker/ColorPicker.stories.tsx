import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import ColorPicker from './ColorPicker'

const meta: Meta<typeof ColorPicker> = {
  title: 'Example/ColorPicker',
  component: ColorPicker,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark'
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    const [color, setColor] = useState('#0A84FF')
    const [opacity, setOpacity] = useState(0.72)

    return (
      <div className="min-h-[320px] bg-[#1B1C1D] p-10">
        <ColorPicker
          color={color}
          opacity={opacity}
          onChange={(next) => {
            setColor(next.color)
            setOpacity(next.opacity)
          }}
        />
      </div>
    )
  }
}
