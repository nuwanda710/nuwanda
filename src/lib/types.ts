export type BookFormat = 'txt' | 'epub'

export type ThemeName = 'light' | 'sepia' | 'dark'

export interface Book {
  id: string
  title: string
  author?: string
  format: BookFormat
  /** EPUB 封面（缩小后的 dataURL）；TXT 无封面 */
  cover?: string
  chapterCount: number
  addedAt: number
}

export interface Chapter {
  title: string
  content: string
}

export interface ReadingProgress {
  /** TXT: 章节序号；EPUB: spine 序号 */
  chapterIndex: number
  /** EPUB 的 CFI 精确定位 */
  cfi?: string
  /** TXT 当前页（0-based） */
  page: number
  /** 0-100 */
  percent: number
  updatedAt: number
}

export interface ReaderSettings {
  /** px，14-24 */
  fontSize: number
  /** 1.5-2.0 */
  lineHeight: number
  theme: ThemeName
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  lineHeight: 1.8,
  theme: 'light',
}
