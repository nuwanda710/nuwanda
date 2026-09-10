import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomBar from '../components/BottomBar'
import SettingsPanel from '../components/SettingsPanel'
import TocDrawer from '../components/TocDrawer'
import TopBar from '../components/TopBar'
import { getFile } from '../lib/db'
import { EpubController } from '../lib/epub-view'
import type { TocItem } from '../lib/epub-view'
import { getProgress, listBooks, loadSettings, saveProgress, saveSettings } from '../lib/storage'
import type { Book, Chapter, ReaderSettings, ReadingProgress } from '../lib/types'
import { decodeBuffer, parseChapters } from '../lib/txt-parser'
import { TxtPaginator } from '../lib/txt-paginator'
import '../styles/reader.css'

export default function Reader() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState('')
  const [chapters, setChapters] = useState<Chapter[] | null>(null)
  const [epubBuffer, setEpubBuffer] = useState<ArrayBuffer | null>(null)
  const [epubToc, setEpubToc] = useState<TocItem[] | null>(null)
  const [epubSpineCount, setEpubSpineCount] = useState(1)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [page, setPage] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [percent, setPercent] = useState(0)
  const [chromeVisible, setChromeVisible] = useState(false)
  const [showToc, setShowToc] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<ReaderSettings>(() => loadSettings())

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const epubHostRef = useRef<HTMLDivElement | null>(null)
  const paginatorRef = useRef<TxtPaginator | null>(null)
  const epubRef = useRef<EpubController | null>(null)
  const pageRef = useRef(0)
  const pendingPageRef = useRef<number | null>(null)
  const pendingLastRef = useRef(false)
  const epubProgressRef = useRef<ReadingProgress | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)

  const isTxt = book?.format === 'txt'
  const isEpub = book?.format === 'epub'

  // ---------- 载入书籍 ----------

  useEffect(() => {
    const meta = listBooks().find((b) => b.id === id)
    if (!meta) {
      setError('书籍不存在或已删除')
      return
    }
    let cancelled = false
    void (async () => {
      const buf = await getFile(id)
      if (cancelled) return
      if (!buf) {
        setError('文件数据丢失，请重新导入')
        return
      }
      if (meta.format === 'txt') {
        const chs = parseChapters(decodeBuffer(buf))
        const p = getProgress(id)
        setChapterIndex(p ? Math.min(Math.max(p.chapterIndex, 0), chs.length - 1) : 0)
        pendingPageRef.current = p ? p.page : 0
        setChapters(chs)
      } else {
        epubProgressRef.current = getProgress(id)
        setEpubBuffer(buf)
      }
      setBook(meta)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  // ---------- TXT：分页布局 ----------

  useEffect(() => {
    if (!isTxt || !chapters || !viewportRef.current || !contentRef.current) return
    const paginator = new TxtPaginator(viewportRef.current, contentRef.current)
    paginatorRef.current = paginator
    paginator.layout()
    if (pendingPageRef.current !== null) {
      paginator.go(pendingPageRef.current)
      pendingPageRef.current = null
    } else if (pendingLastRef.current) {
      paginator.go(paginator.pageCount - 1)
      pendingLastRef.current = false
    } else {
      paginator.go(pageRef.current)
    }
    pageRef.current = paginator.page
    setPage(paginator.page)
    setPageCount(paginator.pageCount)

    const onResize = () => {
      paginator.layout()
      paginator.go(pageRef.current)
      setPageCount(paginator.pageCount)
      setPage(paginator.page)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      paginatorRef.current = null
    }
  }, [isTxt, chapters, chapterIndex, settings.fontSize, settings.lineHeight])

  // ---------- TXT：进度持久化 ----------

  useEffect(() => {
    if (!isTxt || !chapters || !id) return
    const total = chapters.length
    const pct = Math.min(100, Math.round(((chapterIndex + page / Math.max(1, pageCount)) / total) * 100))
    setPercent(pct)
    saveProgress(id, { chapterIndex, page, percent: pct, updatedAt: Date.now() })
  }, [isTxt, chapters, id, chapterIndex, page, pageCount])

  // ---------- EPUB：控制器 ----------

  useEffect(() => {
    if (!isEpub || !epubBuffer || !epubHostRef.current) return
    const controller = new EpubController(epubHostRef.current, epubBuffer, settings)
    epubRef.current = controller
    let disposed = false
    const off = controller.onRelocated((info) => {
      const spineCount = controller.getSpineCount()
      const pct = spineCount > 1 ? Math.min(100, Math.round((info.chapterIndex / (spineCount - 1)) * 100)) : 100
      setChapterIndex(info.chapterIndex)
      setPercent(pct)
      if (id) {
        saveProgress(id, {
          chapterIndex: info.chapterIndex,
          cfi: info.cfi,
          page: 0,
          percent: pct,
          updatedAt: Date.now(),
        })
      }
    })
    void controller.init().then(() => {
      if (disposed) return
      setEpubToc(controller.getToc())
      setEpubSpineCount(controller.getSpineCount())
      const p = epubProgressRef.current
      void controller.display(p?.cfi ?? p?.chapterIndex ?? 0)
    })
    return () => {
      disposed = true
      off()
      controller.destroy()
      epubRef.current = null
    }
    // settings 仅作初始主题，后续变更由下方 applySettings effect 处理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEpub, epubBuffer, id])

  // ---------- EPUB：设置即时生效 ----------

  useEffect(() => {
    epubRef.current?.applySettings(settings)
  }, [settings])

  // ---------- 主题同步到全局 UI ----------

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  // ---------- 翻页动作 ----------

  const txtNext = useCallback(() => {
    if (!chapters) return
    const paginator = paginatorRef.current
    if (paginator && paginator.next()) {
      pageRef.current = paginator.page
      setPage(paginator.page)
    } else if (chapterIndex < chapters.length - 1) {
      pendingPageRef.current = 0
      setChapterIndex(chapterIndex + 1)
    }
  }, [chapters, chapterIndex])

  const txtPrev = useCallback(() => {
    if (!chapters) return
    const paginator = paginatorRef.current
    if (paginator && paginator.prev()) {
      pageRef.current = paginator.page
      setPage(paginator.page)
    } else if (chapterIndex > 0) {
      pendingLastRef.current = true
      setChapterIndex(chapterIndex - 1)
    }
  }, [chapters, chapterIndex])

  const goNext = useCallback(() => {
    if (isTxt) txtNext()
    else epubRef.current?.next()
  }, [isTxt, txtNext])

  const goPrev = useCallback(() => {
    if (isTxt) txtPrev()
    else epubRef.current?.prev()
  }, [isTxt, txtPrev])

  // ---------- 触控 / 键盘交互 ----------

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerRef.current = { x: e.clientX, y: e.clientY }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerRef.current
    pointerRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      // 水平滑动翻页
      if (dx < 0) goNext()
      else goPrev()
      return
    }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      // 点击分区：左 1/3 上一页，右 1/3 下一页，中间切换工具栏
      const w = window.innerWidth
      if (e.clientX < w * 0.33) goPrev()
      else if (e.clientX > w * 0.67) goNext()
      else setChromeVisible((v) => !v)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  // ---------- 目录 / 设置 ----------

  const tocItems = isTxt
    ? (chapters?.map((c) => ({ label: c.title || '未命名', depth: 0 })) ?? [])
    : (epubToc ?? [])

  const currentTocIndex = isTxt
    ? chapterIndex
    : (epubToc?.findIndex((item) => epubRef.current?.spineIndexOf(item.href) === chapterIndex) ?? -1)

  const handleTocSelect = (index: number) => {
    setShowToc(false)
    if (isTxt && chapters) {
      pendingPageRef.current = 0
      setChapterIndex(Math.min(index, chapters.length - 1))
    } else if (isEpub && epubToc && epubToc[index]) {
      void epubRef.current?.display(epubToc[index].href)
    }
  }

  const updateSettings = (partial: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial }
      saveSettings(next)
      return next
    })
  }

  // ---------- 渲染 ----------

  if (error) {
    return (
      <div className="reader-status">
        <p>{error}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>
          返回书架
        </button>
      </div>
    )
  }

  const chapterTitle = isTxt
    ? (chapters?.[chapterIndex]?.title ?? '')
    : `章节 ${chapterIndex + 1} / ${epubSpineCount}`

  return (
    <div className="reader">
      <TopBar visible={chromeVisible} title={book?.title ?? ''} onBack={() => navigate('/')} />

      <div className="reader-stage">
        {isTxt && chapters ? (
          <div className="txt-viewport" ref={viewportRef}>
            <div
              className="txt-content"
              ref={contentRef}
              style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight }}
            >
              {chapters[chapterIndex]?.content ?? ''}
            </div>
          </div>
        ) : isEpub ? null : (
          <div className="reader-status">加载中…</div>
        )}
        <div className={`epub-host${isEpub ? '' : ' hidden'}`} ref={epubHostRef} />
      </div>

      <div className="reader-overlay" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} />

      <BottomBar
        visible={chromeVisible}
        chapterTitle={chapterTitle}
        percent={percent}
        onToc={() => setShowToc(true)}
        onSettings={() => setShowSettings(true)}
      />

      {showToc && (
        <TocDrawer items={tocItems} current={currentTocIndex} onSelect={handleTocSelect} onClose={() => setShowToc(false)} />
      )}
      {showSettings && (
        <SettingsPanel settings={settings} onChange={updateSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
