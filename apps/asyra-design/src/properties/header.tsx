import type { ReactNode } from 'react'

interface HeaderProps {
  label?: string
  actions?: ReactNode
}

const Header = ({ label = '', actions }: HeaderProps) => {
  return (
    <div className="flex items-center justify-between h-10 pl-4 pr-2 text-[18px] text-[#ebebeb]">
      <span className="text-[0.8125em] font-semibold text-white tracking-wider">
        {label}
      </span>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  )
}

export default Header
