import type { ReaderSettings } from '../lib/types'

interface Props {
  settings: ReaderSettings
  onChange: (partial: Partial<ReaderSettings>) => void
  onClose: () => void
}

const LINE_HEIGHTS = [1.5, 1.8, 2]

export default function SettingsPanel({ settings, onChange, onClose }: Props) {
  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <span>阅读设置</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body settings-body">
          <div className="setting-row">
            <span className="setting-label">字号</span>
            <div className="stepper">
              <button onClick={() => onChange({ fontSize: Math.max(14, settings.fontSize - 1) })}>A−</button>
              <span className="stepper-value">{settings.fontSize}</span>
              <button onClick={() => onChange({ fontSize: Math.min(24, settings.fontSize + 1) })}>A＋</button>
            </div>
          </div>
          <div className="setting-row">
            <span className="setting-label">行距</span>
            <div className="segmented">
              {LINE_HEIGHTS.map((v) => (
                <button key={v} className={settings.lineHeight === v ? 'active' : ''} onClick={() => onChange({ lineHeight: v })}>
                  {v.toFixed(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="setting-row">
            <span className="setting-label">主题</span>
            <div className="segmented">
              <button
                className={`theme-swatch light${settings.theme === 'light' ? ' active' : ''}`}
                aria-label="日间"
                onClick={() => onChange({ theme: 'light' })}
              />
              <button
                className={`theme-swatch sepia${settings.theme === 'sepia' ? ' active' : ''}`}
                aria-label="护眼"
                onClick={() => onChange({ theme: 'sepia' })}
              />
              <button
                className={`theme-swatch dark${settings.theme === 'dark' ? ' active' : ''}`}
                aria-label="夜间"
                onClick={() => onChange({ theme: 'dark' })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
