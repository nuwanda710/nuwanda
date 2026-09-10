import type { Book } from '../lib/types'

interface Props {
  book: Book
  percent: number | null
  onOpen: () => void
  onDelete: () => void
}

export default function BookCard({ book, percent, onOpen, onDelete }: Props) {
  return (
    <div className="book-card">
      <button className="book-main" onClick={onOpen}>
        <div className="book-cover">
          {book.cover ? (
            <img src={book.cover} alt="" loading="lazy" />
          ) : (
            <span className="book-cover-fallback">{book.title.slice(0, 1)}</span>
          )}
          {percent !== null && percent > 0 && <span className="book-progress">{percent}%</span>}
        </div>
        <div className="book-title" title={book.title}>
          {book.title}
        </div>
        <div className="book-sub">{book.author || `${book.format.toUpperCase()} · ${book.chapterCount} 章`}</div>
      </button>
      <button className="book-delete" aria-label="删除" onClick={onDelete}>
        ✕
      </button>
    </div>
  )
}
