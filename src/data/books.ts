import { uid } from '@/lib/utils'
import type { Book, BookCategory, BooksState, BorrowRecord } from '@/types'

export const BOOK_CATEGORIES: BookCategory[] = [
  { id: 'literature', nameKey: 'books.category.literature' },
  { id: 'tech', nameKey: 'books.category.tech' },
  { id: 'history', nameKey: 'books.category.history' },
  { id: 'kids', nameKey: 'books.category.kids' },
  { id: 'art', nameKey: 'books.category.art' },
]

export const BOOK_LOAN_DAYS = 14

// 预置演示图书 12 本
const seedBooks = (): Book[] => [
  { id: uid(), title: '三体', author: '刘慈欣', isbn: '9787536692930', categoryId: 'literature', coverUrl: null, totalStock: 3, availableStock: 2 },
  { id: uid(), title: '活着', author: '余华', isbn: '9787506365437', categoryId: 'literature', coverUrl: null, totalStock: 2, availableStock: 1 },
  { id: uid(), title: '百年孤独', author: '加西亚·马尔克斯', isbn: '9787544253994', categoryId: 'literature', coverUrl: null, totalStock: 2, availableStock: 2 },
  { id: uid(), title: '人类简史', author: '尤瓦尔·赫拉利', isbn: '9787508647357', categoryId: 'history', coverUrl: null, totalStock: 2, availableStock: 2 },
  { id: uid(), title: '万历十五年', author: '黄仁宇', isbn: '9787101054491', categoryId: 'history', coverUrl: null, totalStock: 1, availableStock: 0 },
  { id: uid(), title: '算法导论', author: 'Thomas H. Cormen', isbn: '9787111407010', categoryId: 'tech', coverUrl: null, totalStock: 2, availableStock: 2 },
  { id: uid(), title: '代码整洁之道', author: 'Robert C. Martin', isbn: '9787115217486', categoryId: 'tech', coverUrl: null, totalStock: 3, availableStock: 3 },
  { id: uid(), title: '小王子', author: '圣埃克苏佩里', isbn: '9787020042494', categoryId: 'kids', coverUrl: null, totalStock: 4, availableStock: 4 },
  { id: uid(), title: '夏洛的网', author: 'E·B·怀特', isbn: '9787532748754', categoryId: 'kids', coverUrl: null, totalStock: 2, availableStock: 2 },
  { id: uid(), title: '艺术的故事', author: '贡布里希', isbn: '9787549557882', categoryId: 'art', coverUrl: null, totalStock: 1, availableStock: 1 },
  { id: uid(), title: '认识电影', author: 'Louis Giannetti', isbn: '9787506287098', categoryId: 'art', coverUrl: null, totalStock: 2, availableStock: 2 },
  { id: uid(), title: '深入理解计算机系统', author: 'Randal E. Bryant', isbn: '9787111544937', categoryId: 'tech', coverUrl: null, totalStock: 2, availableStock: 2 },
]

// 预置演示借阅记录：一笔借阅中（三体，5 天前）、一笔逾期（活着，20 天前）、一笔管理员代借（万历十五年，10 天前），以及若干历史记录。
function seedRecords(books: Book[]): BorrowRecord[] {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const findByTitle = (title: string) => {
    const b = books.find((x) => x.title === title)
    if (!b) throw new Error(`seed book not found: ${title}`)
    return b
  }
  const mk = (book: Book, borrower: string, daysAgoBorrow: number, daysAgoReturn: number | null) => {
    const borrowedAt = new Date(now - daysAgoBorrow * day).toISOString()
    const dueDate = new Date(now - daysAgoBorrow * day + BOOK_LOAN_DAYS * day).toISOString()
    const returnedAt = daysAgoReturn === null ? null : new Date(now - daysAgoReturn * day).toISOString()
    return { id: uid(), bookId: book.id, bookTitle: book.title, borrowerName: borrower, borrowedAt, dueDate, returnedAt }
  }
  const santi = findByTitle('三体')
  const huozhe = findByTitle('活着')
  const wanli = findByTitle('万历十五年')
  const active: BorrowRecord[] = [
    mk(santi, '我', 5, null),      // 借阅中
    mk(huozhe, '我', 20, null),    // 逾期（20 天前借出，应还 6 天前）
    mk(wanli, '代借读者', 10, null), // 管理员代借，万历十五年已借出
  ]
  // 两笔已归还历史记录
  const history: BorrowRecord[] = [
    mk(santi, '我', 45, 30),
    mk(findByTitle('人类简史'), '我', 40, 25),
  ]
  return [...active, ...history]
}

export function createInitialBooksState(): BooksState {
  const books = seedBooks()
  const borrowRecords = seedRecords(books)
  return {
    books,
    borrowRecords,
    categories: BOOK_CATEGORIES,
    ui: {
      role: 'admin',
      activeTab: 'list',
      keyword: '',
      categoryFilter: 'all',
    },
  }
}

export const ME_BORROWER_KEY = 'books.common.me'
export const GUEST_BORROWER_KEY = 'books.common.guest'
