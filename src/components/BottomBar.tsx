interface Props {
  visible: boolean
  chapterTitle: string
  percent: number
  onToc: () => void
  onSettings: () => void
}

export default function BottomBar({ visible, chapterTitle, percent, onToc, onSettings }: Props) {
  return (
    <div className={`reader-bar bottom${visible ? ' show' : ''}`}>
      <div className="bar-progress">
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="bar-row">
        <span className="bar-chapter">{chapterTitle}</span>
        <span>{percent}%</span>
      </div>
      <div className="bar-actions">
        <button onClick={onToc}>目录</button>
        <button onClick={onSettings}>设置</button>
      </div>
    </div>
  )
}
