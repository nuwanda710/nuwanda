/** TXT 解析：编码探测（UTF-8 / GBK / Big5）+ 章节切分 */

import type { Chapter } from './types'

/** 常见章节标题行：如 "第一章"、"第12回 大战"、"第3节 风波"、以及序章/楔子/番外等 */
const CHAPTER_RE =
  /^[ \t\uFEFF]*(第[0-9一二三四五六七八九十百千万零〇两]{1,7}[章节卷集部回][^\n]{0,30}|序章|序言|楔子|引子|后记|尾声|番外[^\n]{0,20})$/

/** 无章节标记时的伪章节长度 */
const PSEUDO_CHAPTER_SIZE = 20000

/** 解码探测顺序：严格 UTF-8 优先，失败再尝试中文扩展编码 */
const ENCODINGS = ['utf-8', 'gbk', 'gb18030', 'big5'] as const

export function decodeBuffer(buf: ArrayBuffer): string {
  for (const encoding of ENCODINGS) {
    try {
      return new TextDecoder(encoding, { fatal: true }).decode(buf)
    } catch {
      // 尝试下一种编码
    }
  }
  // 全部失败：容错解码，尽量不显示乱码空白
  return new TextDecoder('utf-8', { fatal: false }).decode(buf)
}

export function parseChapters(raw: string): Chapter[] {
  const text = raw.replace(/\r\n?/g, '\n')
  const lines = text.split('\n')

  const chapters: Chapter[] = []
  let title: string | null = null
  let body: string[] = []
  let hasHeader = false

  const flush = () => {
    const content = body.join('\n').trim()
    if (title !== null || content) {
      chapters.push({ title: title ?? '开篇', content })
    }
    body = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length <= 40 && CHAPTER_RE.test(trimmed)) {
      flush()
      hasHeader = true
      title = trimmed
    } else {
      body.push(line)
    }
  }
  flush()

  // 没有任何章节标记：按固定长度切伪章节
  if (!hasHeader) {
    return splitPseudoChapters(text)
  }
  return chapters
}

function splitPseudoChapters(text: string): Chapter[] {
  const trimmed = text.trim()
  if (!trimmed) return [{ title: '正文', content: '' }]
  const chapters: Chapter[] = []
  for (let start = 0, n = 1; start < trimmed.length; start += PSEUDO_CHAPTER_SIZE, n++) {
    chapters.push({
      title: `片段 ${n}`,
      content: trimmed.slice(start, start + PSEUDO_CHAPTER_SIZE),
    })
  }
  return chapters
}
