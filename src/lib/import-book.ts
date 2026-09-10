/** 导入流程：格式识别 → 解析元数据 → 存储 → 建档 */

import { putFile } from './db'
import { addBook } from './storage'
import { readEpubMeta } from './epub-view'
import { decodeBuffer, parseChapters } from './txt-parser'
import type { Book, BookFormat } from './types'

export async function importFile(file: File): Promise<Book> {
  const buf = await file.arrayBuffer()
  const format = detectFormat(file.name, buf)
  const fallbackTitle = file.name.replace(/\.(txt|epub)$/i, '')

  let title = fallbackTitle
  let author: string | undefined
  let cover: string | undefined
  let chapterCount = 1

  if (format === 'epub') {
    const meta = await readEpubMeta(buf)
    if (meta.title) title = meta.title
    author = meta.author || undefined
    cover = meta.cover
    chapterCount = meta.spineCount
  } else {
    chapterCount = parseChapters(decodeBuffer(buf)).length
  }

  const id = uid()
  await putFile(id, buf)
  const book: Book = { id, title, author, format, cover, chapterCount, addedAt: Date.now() }
  addBook(book)
  return book
}

/** crypto.randomUUID 仅在安全上下文可用（PWA 部署在 HTTP 局域网时会缺失），兜底生成 ID */
function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function detectFormat(name: string, buf: ArrayBuffer): BookFormat {
  const lower = name.toLowerCase()
  if (lower.endsWith('.epub')) return 'epub'
  if (lower.endsWith('.txt')) return 'txt'
  // 魔数兜底：PK 头（zip）= epub
  if (buf.byteLength >= 4) {
    const head = new Uint8Array(buf, 0, 4)
    if (head[0] === 0x50 && head[1] === 0x4b) return 'epub'
  }
  return 'txt'
}
