interface Props {
  visible: boolean
  title: string
  onBack: () => void
}

export default function TopBar({ visible, title, onBack }: Props) {
  return (
    <div className={`reader-bar top${visible ? ' show' : ''}`}>
      <div className="bar-inner">
        <button className="bar-back" aria-label="返回书架" onClick={onBack}>
          ‹
        </button>
        <div className="bar-title" title={title}>
          {title}
        </div>
      </div>
    </div>
  )
}
