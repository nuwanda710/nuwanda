/** TXT 分页：CSS Multi-Column 布局 + 水平位移翻页
 *
 * 结构约定：
 *   <div class="txt-viewport">      外层视口，overflow hidden
 *     <div class="txt-content">    文本容器，自身有水平内边距 PAD_H
 *
 * column-fill: auto + 固定高度下，溢出内容沿水平方向生成新列，
 * 每列即一"页"，translateX 即翻页。
 */

/** 列间距（也是翻页时的滑动视觉间距） */
const GAP = 48
/** 与 reader.css 中 .txt-content 的水平 padding 保持一致 */
const PAD_H = 16

export class TxtPaginator {
  page = 0
  pageCount = 1

  private viewport: HTMLElement
  private content: HTMLElement
  private unit = 0 // 列宽 + 列间距

  constructor(viewport: HTMLElement, content: HTMLElement) {
    this.viewport = viewport
    this.content = content
  }

  /** 应用列布局并重算页数（字号/行距/章节/窗口尺寸变化后调用） */
  layout(): void {
    const vw = this.viewport.clientWidth
    if (vw <= 0) return
    const columnWidth = Math.max(120, vw - PAD_H * 2)
    this.unit = columnWidth + GAP
    this.content.style.columnWidth = `${columnWidth}px`
    this.content.style.columnGap = `${GAP}px`
    // scrollWidth ≈ 2*PAD_H + n*列宽 + (n-1)*间距，反解 n
    this.pageCount = Math.max(1, Math.round((this.content.scrollWidth - PAD_H * 2 + GAP) / this.unit))
    this.clamp()
  }

  /** 跳转到指定页（自动收敛到有效范围） */
  go(page: number): void {
    this.page = page
    this.clamp()
    this.content.style.transform = `translateX(${-this.page * this.unit}px)`
  }

  next(): boolean {
    if (this.page >= this.pageCount - 1) return false
    this.go(this.page + 1)
    return true
  }

  prev(): boolean {
    if (this.page <= 0) return false
    this.go(this.page - 1)
    return true
  }

  private clamp(): void {
    this.page = Math.min(Math.max(this.page, 0), this.pageCount - 1)
  }
}
