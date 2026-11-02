import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Accessibility, AlertTriangle, ArrowLeft, BookOpen, BookOpenCheck, Clock, Languages, Pencil, Plus, Search, Trash2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { AppAction, Book, BooksState, BorrowRecord } from '@/types'

interface BooksViewProps {
  state: BooksState
  lastMessage: string
  language: string
  elderly: boolean
  onToggleLanguage: () => void
  onToggleElderly: () => void
  onBack: () => void
  onDispatch: (action: AppAction) => void
}

// 派生状态计算
function deriveRecordStatus(r: BorrowRecord, nowMs: number): 'borrowing' | 'overdue' | 'returned' {
  if (r.returnedAt) return 'returned'
  return nowMs > new Date(r.dueDate).getTime() ? 'overdue' : 'borrowing'
}

function bookHasOverdue(book: Book, records: BorrowRecord[], nowMs: number) {
  return records.some((r) => r.bookId === book.id && r.returnedAt === null && nowMs > new Date(r.dueDate).getTime())
}

// 封面占位：分类渐变色 + 书名首字
const CATEGORY_GRADIENTS: Record<string, string> = {
  literature: 'from-chili-500 to-chili-700',
  tech: 'from-charcoal-700 to-charcoal-900',
  history: 'from-amber-400 to-amber-500',
  kids: 'from-chili-500 to-amber-400',
  art: 'from-chili-600 to-charcoal-700',
}

function BookCover({ book, categoryName }: { book: Book; categoryName: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const initial = (book.title || '?').trim().charAt(0)
  const grad = CATEGORY_GRADIENTS[book.categoryId] ?? 'from-chili-500 to-chili-700'
  const showImg = !!book.coverUrl && !imgFailed
  return (
    <div className={cn('relative flex aspect-[3/4] w-full items-end overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-sm', grad)}>
      {showImg && (
        <img
          src={book.coverUrl!}
          alt={book.title}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
      <div className="relative z-10 flex w-full items-end justify-between p-3">
        <span className="text-3xl font-black drop-shadow">{initial}</span>
        <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">{categoryName}</span>
      </div>
    </div>
  )
}

function formatDate(iso: string, language: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit' })
  } catch {
    return iso
  }
}

export function BooksView({ state, lastMessage, language, elderly, onToggleLanguage, onToggleElderly, onBack, onDispatch }: BooksViewProps) {
const { t } = useTranslation()
  const { books, borrowRecords, categories, ui } = state
  const isAdmin = ui.role === 'admin'
  const nowMs = Date.now()

  // ---- 表单 / 对话框局部状态 ----
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{ title: string; author: string; isbn: string; categoryId: string; coverUrl: string; totalStock: string }>({
    title: '', author: '', isbn: '', categoryId: categories[0]?.id ?? 'literature', coverUrl: '', totalStock: '1',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [confirm, setConfirm] = useState<null | {
    kind: 'delete' | 'borrow' | 'return'
    title: string
    bookId?: string
    recordId?: string
    hint?: string
  }>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // ---- 过滤 / 搜索 ----
  const filteredBooks = useMemo(() => {
    const kw = ui.keyword.trim().toLowerCase()
    return books.filter((b) => {
      if (ui.categoryFilter !== 'all' && b.categoryId !== ui.categoryFilter) return false
      if (!kw) return true
      return (
        b.title.toLowerCase().includes(kw) ||
        b.author.toLowerCase().includes(kw) ||
        (b.isbn ?? '').toLowerCase().includes(kw)
      )
    })
  }, [books, ui.keyword, ui.categoryFilter])

  // ---- 借阅记录分区 ----
  const visibleRecords = useMemo(() => {
    if (isAdmin) return borrowRecords
    return borrowRecords.filter((r) => r.borrowerName === '__me__')
  }, [borrowRecords, isAdmin])

  const activeRecords = useMemo(
    () => visibleRecords
      .filter((r) => !r.returnedAt)
      .map((r) => ({ r, status: deriveRecordStatus(r, nowMs) as 'borrowing' | 'overdue' }))
      .sort((a, b) => {
        // 逾期优先，其次按 dueDate 升序
        if (a.status !== b.status) return a.status === 'overdue' ? -1 : 1
        return a.r.dueDate.localeCompare(b.r.dueDate)
      }),
    [visibleRecords, nowMs],
  )
  const historyRecords = useMemo(
    () => visibleRecords
      .filter((r) => !!r.returnedAt)
      .sort((a, b) => (b.returnedAt! as string).localeCompare(a.returnedAt!)),
    [visibleRecords],
  )

  // ---- 统计 ----
  const stats = useMemo(() => {
    const total = books.reduce((s, b) => s + b.totalStock, 0)
    const available = books.reduce((s, b) => s + b.availableStock, 0)
    const overdue = borrowRecords.filter((r) => r.returnedAt === null && nowMs > new Date(r.dueDate).getTime()).length
    return { total, loaned: total - available, overdue }
  }, [books, borrowRecords, nowMs])

  // ---- 操作 ----
  const openAdd = () => {
    setEditingId(null)
    setForm({ title: '', author: '', isbn: '', categoryId: categories[0]?.id ?? 'literature', coverUrl: '', totalStock: '1' })
    setFormErrors({})
    setFormOpen(true)
  }
  const openEdit = (b: Book) => {
    setEditingId(b.id)
    setForm({
      title: b.title, author: b.author, isbn: b.isbn ?? '', categoryId: b.categoryId,
      coverUrl: b.coverUrl ?? '', totalStock: String(b.totalStock),
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const submitForm = () => {
    const errs: Record<string, string> = {}
    const title = form.title.trim()
    const author = form.author.trim()
    const isbn = form.isbn.trim()
    const categoryId = form.categoryId
    const coverUrl = form.coverUrl.trim()
    const totalStockNum = Number(form.totalStock)
    if (!title) errs.title = t('books.form.err_required')
    if (!author) errs.author = t('books.form.err_required')
    if (!categoryId) errs.categoryId = t('books.form.err_required')
    if (!Number.isInteger(totalStockNum) || totalStockNum < 0) errs.totalStock = t('books.form.err_stock_invalid')
    if (Object.keys(errs).length) {
      setFormErrors(errs)
      return
    }
    if (editingId) {
      const prev = books.find((b) => b.id === editingId)!
      const loaned = prev.totalStock - prev.availableStock
      if (totalStockNum < loaned) {
        errs.totalStock = t('books.form.err_stock_too_low', { count: loaned })
        setFormErrors(errs)
        return
      }
      onDispatch({
        type: 'BOOKS_UPDATE', id: editingId,
        patch: { title, author, isbn: isbn || null, categoryId, coverUrl: coverUrl || null, totalStock: totalStockNum },
      })
    } else {
      onDispatch({
        type: 'BOOKS_ADD',
        input: { title, author, isbn: isbn || null, categoryId, coverUrl: coverUrl || null, totalStock: totalStockNum },
      })
    }
    setFormOpen(false)
  }

  const askDelete = (b: Book) => {
    setConfirmError(null)
    setConfirm({ kind: 'delete', title: b.title, bookId: b.id })
  }
  const askBorrow = (b: Book) => {
    setConfirmError(null)
    setConfirm({ kind: 'borrow', title: b.title, bookId: b.id, hint: t('books.confirm.due_hint', { date: formatDate(new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(), language) }) })
  }
  const askReturn = (r: BorrowRecord) => {
    setConfirmError(null)
    setConfirm({ kind: 'return', title: r.bookTitle, recordId: r.id, bookId: r.bookId })
  }

  const handleConfirm = () => {
    if (!confirm) return
    if (confirm.kind === 'delete') {
      const book = books.find((b) => b.id === confirm.bookId)
      if (book && borrowRecords.some((r) => r.bookId === book.id && r.returnedAt === null)) {
        setConfirmError(t('books.tip.has_active_borrow'))
        return
      }
      onDispatch({ type: 'BOOKS_DELETE', id: confirm.bookId! })
    } else if (confirm.kind === 'borrow') {
      onDispatch({ type: 'BOOKS_BORROW', bookId: confirm.bookId! })
    } else if (confirm.kind === 'return') {
      onDispatch({ type: 'BOOKS_RETURN', recordId: confirm.recordId })
    }
    setConfirm(null)
    setConfirmError(null)
  }

  const categoryName = (id: string) => t(categories.find((c) => c.id === id)?.nameKey ?? 'books.category.unknown')

  // ---- 渲染 ----
  return (
    <div className="min-h-screen bg-rice-100 paper-noise">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-30 border-b border-charcoal-900/5 bg-rice-50/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:px-6">
          <button onClick={onBack} className="flex items-center gap-2 rounded-xl px-2 py-2 text-charcoal-700 transition hover:bg-rice-200" aria-label={t('common.aria_close')}>
            <ArrowLeft size={18} /><span className="hidden text-sm font-semibold sm:inline">{t('books.back')}</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chili-500 text-white shadow-md"><BookOpen size={18} /></span>
            <span className="hidden sm:block"><strong className="block leading-4 text-charcoal-900">{t('books.title')}</strong><small className="text-charcoal-500">{t('books.subtitle')}</small></span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={onToggleElderly} aria-label={elderly ? t("books.aria.elderly_off") : t("books.aria.elderly_on")}>
              <Accessibility size={18} className={elderly ? 'text-chili-500' : ''} />
            </Button>
            <Button variant="outline" size="sm" onClick={onToggleLanguage} aria-label={t('common.aria_lang')}>
              <Languages size={16} />{language === 'zh' ? 'EN' : '中'}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 pb-16 lg:px-6 lg:py-7">
        {/* Hero / 统计 */}
        <section className="animate-rise rounded-3xl border border-white/80 bg-white/90 p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-charcoal-900 sm:text-3xl">{t('books.hero_title')}</h1>
              <p className="mt-1 text-sm text-charcoal-500">{t('books.hero_desc')}</p>
            </div>
            {/* 角色切换 */}
            <div className="inline-flex rounded-full bg-rice-200 p-1">
              <button
                onClick={() => onDispatch({ type: 'BOOKS_SET_ROLE', role: 'admin' })}
                className={cn('rounded-full px-4 py-2 text-sm font-semibold transition', ui.role === 'admin' ? 'bg-chili-500 text-white shadow' : 'text-charcoal-700')}
              >
                {t('books.role.admin')}
              </button>
              <button
                onClick={() => onDispatch({ type: 'BOOKS_SET_ROLE', role: 'reader' })}
                className={cn('rounded-full px-4 py-2 text-sm font-semibold transition', ui.role === 'reader' ? 'bg-chili-500 text-white shadow' : 'text-charcoal-700')}
              >
                {t('books.role.reader')}
              </button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <StatPill label={t('books.stats.total')} value={stats.total} tone="chili" />
            <StatPill label={t('books.stats.loaned')} value={stats.loaned} tone="charcoal" />
            <StatPill label={t('books.stats.overdue')} value={stats.overdue} tone={stats.overdue > 0 ? 'amber' : 'charcoal'} />
          </div>
        </section>

        {/* Tabs */}
        <div className="mt-5 flex gap-2">
          <TabButton active={ui.activeTab === 'list'} onClick={() => onDispatch({ type: 'BOOKS_SET_TAB', tab: 'list' })}>
            <BookOpen size={16} />{t('books.tab.list')}
          </TabButton>
          <TabButton active={ui.activeTab === 'records'} onClick={() => onDispatch({ type: 'BOOKS_SET_TAB', tab: 'records' })}>
            <BookOpenCheck size={16} />{t('books.tab.records')}
            {activeRecords.length > 0 && (
              <span className={cn('ml-1 rounded-full px-1.5 text-[11px]', activeRecords.some((x) => x.status === 'overdue') ? 'bg-amber-400 text-charcoal-900' : 'bg-chili-100 text-chili-700')}>
                {activeRecords.length}
              </span>
            )}
          </TabButton>
        </div>

        {ui.activeTab === 'list' && (
          <section className="mt-4 animate-rise">
            {/* 工具栏 */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm sm:p-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-500" />
                <input
                  type="text"
                  value={ui.keyword}
                  onChange={(e) => onDispatch({ type: 'BOOKS_SET_KEYWORD', keyword: e.target.value })}
                  placeholder={t('books.search_placeholder')}
                  className="h-11 w-full rounded-xl border border-charcoal-900/10 bg-rice-50 pl-9 pr-9 text-sm outline-none transition focus:border-chili-500 focus:bg-white"
                />
                {ui.keyword && (
                  <button onClick={() => onDispatch({ type: 'BOOKS_SET_KEYWORD', keyword: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-charcoal-500 hover:bg-rice-200" aria-label={t('common.aria_close')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-none">
                <CategoryChip active={ui.categoryFilter === 'all'} onClick={() => onDispatch({ type: 'BOOKS_SET_CATEGORY', categoryId: 'all' })}>{t('books.category.all')}</CategoryChip>
                {categories.map((c) => (
                  <CategoryChip key={c.id} active={ui.categoryFilter === c.id} onClick={() => onDispatch({ type: 'BOOKS_SET_CATEGORY', categoryId: c.id })}>
                    {t(c.nameKey)}
                  </CategoryChip>
                ))}
              </div>
              {isAdmin && (
                <Button onClick={openAdd} className="ml-auto">
                  <Plus size={16} />{t('books.action.add')}
                </Button>
              )}
            </div>

            {/* 图书网格 */}
            {filteredBooks.length === 0 ? (
              <EmptyState title={books.length === 0 && isAdmin ? t('books.empty.no_books') : t('books.empty.no_result')} desc={books.length === 0 && isAdmin ? t('books.empty.no_books_desc') : t('books.empty.no_result_desc')} />
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredBooks.map((b) => {
                  const inStock = b.availableStock > 0
                  const overdue = bookHasOverdue(b, borrowRecords, nowMs)
                  return (
                    <article key={b.id} className="animate-rise rounded-2xl border border-white/60 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-float">
                      <div className="grid grid-cols-[96px,1fr] gap-3">
                        <div className="w-24"><BookCover book={b} categoryName={categoryName(b.categoryId)} /></div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold text-charcoal-900" title={b.title}>{b.title}</h3>
                          <p className="mt-0.5 truncate text-sm text-charcoal-500">{b.author}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', inStock ? 'bg-chili-50 text-chili-700' : 'bg-amber-100 text-amber-500')}>
                              {inStock ? t('books.status.in_stock') : t('books.status.borrowed_out')}
                            </span>
                            {overdue && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-500">
                                <AlertTriangle size={11} />{t('books.status.has_overdue')}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-charcoal-500">
                            {t('books.stock_label')} <strong className="text-charcoal-900">{b.availableStock}</strong> / {b.totalStock}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {isAdmin ? (
                          <>
                            <Button variant="secondary" size="sm" onClick={() => openEdit(b)}><Pencil size={14} />{t('books.action.edit')}</Button>
                            <Button variant="outline" size="sm" onClick={() => askDelete(b)}><Trash2 size={14} />{t('books.action.delete')}</Button>
                            <Button size="sm" onClick={() => askBorrow(b)} disabled={!inStock}>
                              {t('books.action.borrow')}
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" onClick={() => askBorrow(b)} disabled={!inStock} className="ml-auto" title={inStock ? '' : t('books.tip.no_stock')}>
                            {inStock ? t('books.action.borrow') : t('books.tip.no_stock')}
                          </Button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {ui.activeTab === 'records' && (
          <section className="mt-4 animate-rise space-y-5">
            <RecordGroup title={t('books.records.active')} accent="chili">
              {activeRecords.length === 0 ? (
                <p className="rounded-2xl bg-white p-6 text-center text-sm text-charcoal-500 shadow-sm">{t('books.empty.no_active_records')}</p>
              ) : activeRecords.map(({ r, status }) => (
                <RecordRow
                  key={r.id}
                  r={r}
                  status={status}
                  language={language}
                  isAdmin={isAdmin}
                  onReturn={() => askReturn(r)}
                />
              ))}
            </RecordGroup>
            <RecordGroup title={t('books.records.history')} accent="charcoal">
              {historyRecords.length === 0 ? (
                <p className="rounded-2xl bg-white p-6 text-center text-sm text-charcoal-500 shadow-sm">{t('books.empty.no_history')}</p>
              ) : historyRecords.map((r) => (
                <RecordRow key={r.id} r={r} status="returned" language={language} isAdmin={isAdmin} />
              ))}
            </RecordGroup>
          </section>
        )}
      </main>

      {/* 轻量消息提示 */}
      {lastMessage && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-40 -translate-x-1/2 rounded-full bg-charcoal-900/90 px-4 py-2 text-xs font-semibold text-white shadow-float">
          {lastMessage}
        </div>
      )}

      {/* 新增/编辑 Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) setFormOpen(false) }}>
        <DialogContent title={editingId ? t('books.form.edit_title') : t('books.form.add_title')} className="md:max-w-xl">
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label={t('books.form.title')} error={formErrors.title}>
              <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('books.form.title_placeholder')} />
            </Field>
            <Field label={t('books.form.author')} error={formErrors.author}>
              <input className="form-input" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder={t('books.form.author_placeholder')} />
            </Field>
            <Field label={t('books.form.isbn')}>
              <input className="form-input" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} placeholder={t('books.form.isbn_placeholder')} />
            </Field>
            <Field label={t('books.form.category')} error={formErrors.categoryId}>
              <select className="form-input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                {categories.map((c) => (<option key={c.id} value={c.id}>{t(c.nameKey)}</option>))}
              </select>
            </Field>
            <Field label={t('books.form.cover_url')}>
              <input className="form-input" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} placeholder={t('books.form.cover_placeholder')} />
            </Field>
            <Field label={t('books.form.total_stock')} error={formErrors.totalStock}>
              <input type="number" min={0} className="form-input" value={form.totalStock} onChange={(e) => setForm({ ...form, totalStock: e.target.value })} />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild><Button variant="ghost">{t('books.action.cancel')}</Button></DialogClose>
            <Button onClick={submitForm}>{t('books.action.confirm')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 确认 Dialog（删除 / 借书 / 还书） */}
      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o) { setConfirm(null); setConfirmError(null) } }}>
        <DialogContent title={confirm ? t(`books.confirm.${confirm.kind}_title`, { title: confirm.title }) : ''}>
          <p className="mt-4 text-sm text-charcoal-500">
            {confirm && t(`books.confirm.${confirm.kind}_msg`, { title: confirm.title })}
          </p>
          {confirm?.hint && <p className="mt-2 flex items-center gap-1 text-xs text-charcoal-500"><Clock size={13} />{confirm.hint}</p>}
          {confirmError && (
            <p className="mt-3 flex items-center gap-1 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-500"><AlertTriangle size={15} />{confirmError}</p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild><Button variant="ghost" onClick={() => { setConfirm(null); setConfirmError(null) }}>{t('books.action.cancel')}</Button></DialogClose>
            <Button variant={confirm?.kind === 'delete' ? 'default' : 'default'} onClick={handleConfirm}>{t('books.action.confirm')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        .form-input { height: 2.75rem; width: 100%; border-radius: 0.75rem; border: 1px solid rgba(33,31,28,0.10); background: #fffdf8; padding: 0 0.875rem; font-size: 0.875rem; outline: none; transition: border-color .2s, background-color .2s; }
        .form-input:focus { border-color: #e13b2b; background: #fff; }
      `}</style>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-charcoal-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-chili-600">{error}</span>}
    </label>
  )
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: 'chili' | 'amber' | 'charcoal' }) {
  const toneClass =
    tone === 'chili' ? 'bg-chili-50 text-chili-700'
      : tone === 'amber' ? 'bg-amber-100 text-amber-500'
        : 'bg-rice-100 text-charcoal-700'
  return (
    <div className={cn('rounded-2xl px-4 py-3', toneClass)}>
      <p className="text-xs font-semibold opacity-70">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition',
        active ? 'bg-chili-500 text-white shadow' : 'bg-white text-charcoal-700 hover:bg-rice-200',
      )}
    >
      {children}
    </button>
  )
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition',
        active ? 'bg-chili-500 text-white' : 'bg-rice-100 text-charcoal-700 hover:bg-rice-200',
      )}
    >
      {children}
    </button>
  )
}

function EmptyState({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-charcoal-900/10 bg-white p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rice-100 text-chili-500"><BookOpen size={26} /></div>
      <p className="text-sm font-bold text-charcoal-900">{title}</p>
      {desc && <p className="mt-1 text-xs text-charcoal-500">{desc}</p>}
    </div>
  )
}

function RecordGroup({ title, accent, children }: { title: string; accent: 'chili' | 'charcoal'; children: ReactNode }) {
  return (
    <div>
      <h2 className={cn('mb-2 flex items-center gap-2 text-sm font-bold', accent === 'chili' ? 'text-chili-700' : 'text-charcoal-700')}>
        <span className={cn('inline-block h-2 w-2 rounded-full', accent === 'chili' ? 'bg-chili-500' : 'bg-charcoal-500')} />{title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function RecordRow({ r, status, language, isAdmin, onReturn }: { r: BorrowRecord; status: 'borrowing' | 'overdue' | 'returned'; language: string; isAdmin: boolean; onReturn?: () => void }) {
  const { t } = useTranslation()
  const badge = (() => {
    if (status === 'overdue') return { cls: 'bg-amber-100 text-amber-500', text: t('books.status.overdue'), icon: <AlertTriangle size={12} /> }
    if (status === 'borrowing') return { cls: 'bg-chili-50 text-chili-700', text: t('books.status.borrowing'), icon: <Clock size={12} /> }
    return { cls: 'bg-rice-200 text-charcoal-500', text: t('books.status.returned'), icon: null }
  })()
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-chili-50 text-chili-500"><BookOpen size={20} /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-charcoal-900">{r.bookTitle}</p>
        <p className="mt-0.5 text-xs text-charcoal-500">
          {isAdmin && <span className="mr-2">{t('books.records.borrower')}: <strong className="text-charcoal-700">{
                  r.borrowerName === '__me__' ? t('books.common.me') :
                  r.borrowerName === '__guest__' ? t('books.common.guest') : r.borrowerName
                }</strong></span>}
          <span>{t('books.records.borrowed_at')}: {formatDate(r.borrowedAt, language)}</span>
          <span className="mx-1.5 text-charcoal-300">·</span>
          <span>{t('books.records.due')}: {formatDate(r.dueDate, language)}</span>
          {r.returnedAt && (<><span className="mx-1.5 text-charcoal-300">·</span><span>{t('books.records.returned_at')}: {formatDate(r.returnedAt, language)}</span></>)}
        </p>
      </div>
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', badge.cls)}>{badge.icon}{badge.text}</span>
      {status !== 'returned' && onReturn && (
        <Button size="sm" variant="secondary" onClick={onReturn}>{t('books.action.return_book')}</Button>
      )}
    </div>
  )
}
