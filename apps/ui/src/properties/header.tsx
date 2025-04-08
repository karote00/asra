import { Text } from '@asra/design-system'
import { ROW_HEIGHT } from '../constants'

const Header = ({ label = '' }) => {
  return (
    <div className={`px-3 h-${ROW_HEIGHT} leading-${ROW_HEIGHT}`}>
      <Text label={label} />
    </div>
  )
}

export default Header
