import i18next from 'i18next'
import { uid } from '@/lib/utils'
import { BOOK_LOAN_DAYS, GUEST_BORROWER_KEY, ME_BORROWER_KEY, createInitialBooksState } from '@/data/books'
import type { AppAction, AppState, Book, BooksState } from '@/types'

export const initialBooksState: BooksState = createInitialBooksState()

const DAY_MS = 24 * 60 * 60 * 1000

function addDaysIso(base: string, days: number): string {
  return new Date(new Date(base).getTime() + days * DAY_MS).toISOString()
}

/** 针对 books 子状态处理图书相关 action；其它 action 原样返回 state。 */
export function booksReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'BOOKS_SET_ROLE':
      return { ...state, books: { ...state.books, ui: { ...state.books.ui, role: action.role } } }
    case 'BOOKS_SET_TAB':
      return { ...state, books: { ...state.books, ui: { ...state.books.ui, activeTab: action.tab } } }
    case 'BOOKS_SET_KEYWORD':
      return { ...state, books: { ...state.books, ui: { ...state.books.ui, keyword: action.keyword } } }
    case 'BOOKS_SET_CATEGORY':
      return { ...state, books: { ...state.books, ui: { ...state.books.ui, categoryFilter: action.categoryId } } }

    case 'BOOKS_ADD': {
      const { input } = action
      const newBook: Book = {
        ...input,
        id: uid(),
        availableStock: input.totalStock,
      }
      return {
        ...state,
        books: { ...state.books, books: [...state.books.books, newBook] },
        lastMessage: i18next.t('books.message.added', { title: input.title }),
      }
    }

    case 'BOOKS_UPDATE': {
      const { id, patch } = action
      const book = state.books.books.find((b) => b.id === id)
      if (!book) return state
      const nextTotal = patch.totalStock ?? book.totalStock
      const loaned = book.totalStock - book.availableStock
      if (nextTotal < loaned) {
        return { ...state, lastMessage: i18next.t('books.message.stock_too_low', { count: loaned }) }
      }
      // 调整 availableStock：若 total 减少，按借出数量不变收紧；若增加，增量全部可借。
      const nextAvailable = patch.totalStock !== undefined
        ? nextTotal - loaned
        : book.availableStock
      const updated: Book = { ...book, ...patch, availableStock: nextAvailable }
      // 同步更新历史记录中的 bookTitle 快照
      const borrowRecords = state.books.borrowRecords.map((r) => r.bookId === id ? { ...r, bookTitle: updated.title } : r)
      return {
        ...state,
        books: {
          ...state.books,
          books: state.books.books.map((b) => (b.id === id ? updated : b)),
          borrowRecords,
        },
        lastMessage: i18next.t('books.message.updated', { title: updated.title }),
      }
    }

    case 'BOOKS_DELETE': {
      const { id } = action
      const book = state.books.books.find((b) => b.id === id)
      if (!book) return state
      const hasActive = state.books.borrowRecords.some((r) => r.bookId === id && r.returnedAt === null)
      if (hasActive) {
        return { ...state, lastMessage: i18next.t('books.message.has_active_borrow') }
      }
      return {
        ...state,
        books: { ...state.books, books: state.books.books.filter((b) => b.id !== id) },
        lastMessage: i18next.t('books.message.deleted', { title: book.title }),
      }
    }

    case 'BOOKS_BORROW': {
      const { bookId } = action
      const book = state.books.books.find((b) => b.id === bookId)
      if (!book || book.availableStock <= 0) return state
      const isReader = state.books.ui.role === 'reader'
      const borrowerName = action.borrowerName
        ?? (isReader ? i18next.t(ME_BORROWER_KEY) : i18next.t(GUEST_BORROWER_KEY))
      const now = new Date().toISOString()
      const record = {
        id: uid(),
        bookId,
        bookTitle: book.title,
        borrowerName,
        borrowedAt: now,
        dueDate: addDaysIso(now, BOOK_LOAN_DAYS),
        returnedAt: null,
      }
      return {
        ...state,
        books: {
          ...state.books,
          books: state.books.books.map((b) => (b.id === bookId ? { ...b, availableStock: b.availableStock - 1 } : b)),
          borrowRecords: [record, ...state.books.borrowRecords],
        },
        lastMessage: i18next.t('books.message.borrowed', { title: book.title }),
      }
    }

    case 'BOOKS_RETURN': {
      const { recordId, bookId } = action
      let targetId: string | null = null
      if (recordId) {
        const r = state.books.borrowRecords.find((x) => x.id === recordId && x.returnedAt === null)
        if (r) targetId = r.id
      } else if (bookId) {
        // FIFO: 按 borrowedAt 升序取最早未归还记录
        const candidates = state.books.borrowRecords
          .filter((r) => r.bookId === bookId && r.returnedAt === null)
          .sort((a, b) => a.borrowedAt.localeCompare(b.borrowedAt))
        if (candidates.length) targetId = candidates[0].id
      }
      if (!targetId) return state
      const now = new Date().toISOString()
      const target = state.books.borrowRecords.find((r) => r.id === targetId)!
      const book = state.books.books.find((b) => b.id === target.bookId)
      if (!book) return state
      const nextAvailable = Math.min(book.totalStock, book.availableStock + 1)
      return {
        ...state,
        books: {
          ...state.books,
          books: state.books.books.map((b) => (b.id === book.id ? { ...b, availableStock: nextAvailable } : b)),
          borrowRecords: state.books.borrowRecords.map((r) => (r.id === targetId ? { ...r, returnedAt: now } : r)),
        },
        lastMessage: i18next.t('books.message.returned', { title: book.title }),
      }
    }

    case 'BOOKS_RESET':
      return { ...state, books: createInitialBooksState() }

    default:
      return state
  }
}
