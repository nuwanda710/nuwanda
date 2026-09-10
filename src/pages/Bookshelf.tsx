import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookCard from '../components/BookCard'
import { deleteFile } from '../lib/db'
import { importFile } from '../lib/import-book'
import { getProgress, listBooks, removeBook } from '../lib/storage'
import type { Book } from '../lib/types'

export default function Bookshelf() {
  const [books, setBooks] = useState<Book[]>(() => listBooks())
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const book = await importFile(file)
      navigate(`/read/${book.id}`)
    } catch (e) {
      window.alert(`导入失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = (book: Book) => {
    if (!window.confirm(`删除《${book.title}》？阅读进度将一并清除。`)) return
    removeBook(book.id)
    void deleteFile(book.id)
    setBooks(listBooks())
  }

  return (
    <div className="shelf">
      <header className="shelf-header">
        <h1>书架</h1>
        <button className="btn-primary" disabled={importing} onClick={() => fileRef.current?.click()}>
          {importing ? '导入中…' : '＋ 导入'}
        </button>
      </header>

      {books.length === 0 ? (
        <div className="shelf-empty">
          <p>书架空空如也</p>
          <p className="shelf-empty-hint">点击右上角「导入」，添加 TXT / EPUB 电子书</p>
        </div>
      ) : (
        <div className="shelf-grid">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              percent={getProgress(book.id)?.percent ?? null}
              onOpen={() => navigate(`/read/${book.id}`)}
              onDelete={() => handleDelete(book)}
            />
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".txt,.epub"
        hidden
        onChange={(e) => {
          void handleFile(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
