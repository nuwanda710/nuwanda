export interface TocEntry {
  label: string
  depth: number
}

interface Props {
  items: TocEntry[]
  current: number
  onSelect: (index: number) => void
  onClose: () => void
}

export default function TocDrawer({ items, current, onSelect, onClose }: Props) {
  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <span>目录（{items.length}）</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          {items.map((item, i) => (
            <button
              key={`${item.label}-${i}`}
              className={`toc-item${i === current ? ' active' : ''}`}
              style={{ paddingLeft: `${10 + item.depth * 20}px` }}
              onClick={() => onSelect(i)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
