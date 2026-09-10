/** epubjs 封装：元数据读取 + 阅读控制器 */

import ePub from 'epubjs'
import type { Book as EpubBook, Location, NavItem, Rendition } from 'epubjs'
import type { ReaderSettings, ThemeName } from './types'

export interface TocItem {
  label: string
  href: string
  depth: number
}

export interface EpubMetaInfo {
  title?: string
  author?: string
  cover?: string
  spineCount: number
}

/** relocated 事件提炼出的进度信息 */
export interface RelocatedInfo {
  chapterIndex: number
  cfi?: string
}

const THEME_BODY: Record<ThemeName, { background: string; color: string }> = {
  light: { background: '#ffffff', color: '#1f2937' },
  sepia: { background: '#f5ecd9', color: '#5b4636' },
  dark: { background: '#141414', color: '#c9c9c9' },
}

// ---------- 元数据（导入时用） ----------

export async function readEpubMeta(buf: ArrayBuffer): Promise<EpubMetaInfo> {
  const book = ePub(buf)
  const info: EpubMetaInfo = { spineCount: 1 }
  try {
    const metadata = await book.loaded.metadata
    info.title = metadata?.title || undefined
    info.author = metadata?.creator || undefined
    const spine = await book.loaded.spine
    info.spineCount = spine.length || 1
    info.cover = await shrinkCover(await book.coverUrl().catch(() => null))
  } finally {
    try {
      book.destroy()
    } catch {
      // 忽略销毁异常
    }
  }
  return info
}

async function shrinkCover(url: string | null): Promise<string | undefined> {
  if (!url) return undefined
  try {
    const blob = await (await fetch(url)).blob()
    const dataUrl = await blobToDataUrl(blob)
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const scale = Math.min(1, 240 / Math.max(1, img.naturalWidth))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch {
    return undefined
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('读取封面失败'))
    reader.readAsDataURL(blob)
  })
}

// ---------- 目录工具 ----------

export function flattenToc(items: NavItem[], depth = 0): TocItem[] {
  const out: TocItem[] = []
  for (const item of items) {
    const label = (item.label || '').replace(/\s+/g, ' ').trim()
    if (label) out.push({ label, href: item.href, depth })
    if (item.subitems?.length) out.push(...flattenToc(item.subitems, depth + 1))
  }
  return out
}

// ---------- 阅读控制器 ----------

export class EpubController {
  private book: EpubBook
  private rendition: Rendition
  private destroyed = false
  private relocatedHandlers = new Set<(info: RelocatedInfo) => void>()
  private toc: TocItem[] = []
  private spineLength = 1

  constructor(host: HTMLElement, buf: ArrayBuffer, settings: ReaderSettings) {
    this.book = ePub(buf)
    this.rendition = this.book.renderTo(host, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      spread: 'none',
      allowScriptedContent: false,
    })
    this.rendition.on('relocated', (loc: Location) => {
      if (this.destroyed || !loc?.start) return
      const info: RelocatedInfo = { chapterIndex: loc.start.index, cfi: loc.start.cfi }
      for (const handler of this.relocatedHandlers) handler(info)
    })
    this.applySettings(settings)
  }

  /** 打开书籍并准备目录（完成后再 display） */
  async init(): Promise<void> {
    const [spine, nav] = await Promise.all([this.book.loaded.spine, this.book.loaded.navigation])
    this.spineLength = spine.length || 1
    this.toc = flattenToc(nav?.toc ?? [])
  }

  onRelocated(handler: (info: RelocatedInfo) => void): () => void {
    this.relocatedHandlers.add(handler)
    return () => {
      this.relocatedHandlers.delete(handler)
    }
  }

  async display(target?: string | number): Promise<void> {
    if (this.destroyed) return
    try {
      if (typeof target === 'number') await this.rendition.display(target)
      else await this.rendition.display(target as string)
    } catch {
      // 显示失败（如 CFI 失效）时回退到开头
      try {
        await this.rendition.display(0)
      } catch {
        // 忽略
      }
    }
  }

  next(): void {
    if (!this.destroyed) void this.rendition.next().catch(() => {})
  }

  prev(): void {
    if (!this.destroyed) void this.rendition.prev().catch(() => {})
  }

  getToc(): TocItem[] {
    return this.toc
  }

  getSpineCount(): number {
    return this.spineLength
  }

  /** 目录 href 对应的 spine 序号（用于高亮当前章节），失败返回 -1 */
  spineIndexOf(href: string): number {
    try {
      const section = this.book.spine.get(href) as { index?: number } | undefined
      return typeof section?.index === 'number' ? section.index : -1
    } catch {
      return -1
    }
  }

  applySettings(settings: ReaderSettings): void {
    if (this.destroyed) return
    const theme = THEME_BODY[settings.theme]
    // 注意：register(name, string) 会把字符串当 URL 处理，内联 CSS 必须用 registerCss
    this.rendition.themes.registerCss(
      'app',
      `body { background: ${theme.background} !important; color: ${theme.color} !important; line-height: ${settings.lineHeight} !important; }`,
    )
    this.rendition.themes.select('app')
    this.rendition.themes.fontSize(`${settings.fontSize}px`)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.relocatedHandlers.clear()
    try {
      this.rendition.destroy()
    } catch {
      // 忽略
    }
    try {
      this.book.destroy()
    } catch {
      // 忽略
    }
  }
}
