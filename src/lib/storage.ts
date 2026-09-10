/** localStorage 读写：书架元数据 / 阅读进度 / 阅读设置 */

import { DEFAULT_SETTINGS } from './types'
import type { Book, ReaderSettings, ReadingProgress } from './types'

const BOOKS_KEY = 'reader:books'
const SETTINGS_KEY = 'reader:settings'
const progressKey = (id: string) => `reader:progress:${id}`

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 配额溢出等异常：静默失败，不阻断阅读
  }
}

// ---------- 书架 ----------

export function listBooks(): Book[] {
  return readJSON<Book[]>(BOOKS_KEY) ?? []
}

function saveBooks(books: Book[]): void {
  writeJSON(BOOKS_KEY, books)
}

export function addBook(book: Book): void {
  saveBooks([...listBooks(), book])
}

export function removeBook(id: string): void {
  saveBooks(listBooks().filter((b) => b.id !== id))
  localStorage.removeItem(progressKey(id))
}

// ---------- 进度 ----------

export function getProgress(id: string): ReadingProgress | null {
  return readJSON<ReadingProgress>(progressKey(id))
}

export function saveProgress(id: string, progress: ReadingProgress): void {
  writeJSON(progressKey(id), progress)
}

// ---------- 设置 ----------

export function loadSettings(): ReaderSettings {
  const saved = readJSON<Partial<ReaderSettings>>(SETTINGS_KEY)
  const merged = { ...DEFAULT_SETTINGS, ...saved }
  return {
    fontSize: Math.min(24, Math.max(14, Math.round(merged.fontSize))),
    lineHeight: [1.5, 1.8, 2].includes(merged.lineHeight) ? merged.lineHeight : DEFAULT_SETTINGS.lineHeight,
    theme: merged.theme === 'sepia' || merged.theme === 'dark' ? merged.theme : 'light',
  }
}

export function saveSettings(settings: ReaderSettings): void {
  writeJSON(SETTINGS_KEY, settings)
}
