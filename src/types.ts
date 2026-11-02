export type OrderStage = 'submitted' | 'accepted' | 'cooking' | 'served'
export type ViewName = 'home' | 'welcome' | 'menu' | 'order' | 'checkout' | 'books'

export interface Product {
  id: string
  name: string
  description: string
  category: string
  price: number
  image: string
  badge?: string
  orderedCount?: number
  options?: {
    portion?: string[]
    flavor?: string[]
    spicy?: string[]
  }
}

export interface CartItem {
  uid: string
  productId: string
  name: string
  price: number
  quantity: number
  image: string
  spec: string
  orderedBy: string
}

export interface OrderItem extends CartItem {
  stage: OrderStage
  cancelState?: 'requested' | 'approved'
}

export interface ServiceRequest {
  id: string
  type: string
  createdAt: string
  status: 'waiting' | 'responded'
}

// ---------- 图书管理 ----------
export type BookRole = 'admin' | 'reader'
export type BookTab = 'list' | 'records'

export interface BookCategory {
  id: string
  nameKey: string
}

export interface Book {
  id: string
  title: string
  author: string
  isbn: string | null
  categoryId: string
  coverUrl: string | null
  totalStock: number
  availableStock: number
}

export interface BorrowRecord {
  id: string
  bookId: string
  bookTitle: string
  borrowerName: string
  borrowedAt: string
  dueDate: string
  returnedAt: string | null
}

export interface BooksUIState {
  role: BookRole
  activeTab: BookTab
  keyword: string
  categoryFilter: string // 'all' 或 categoryId
}

export interface BooksState {
  books: Book[]
  borrowRecords: BorrowRecord[]
  categories: BookCategory[]
  ui: BooksUIState
}

export interface AppState {
  view: ViewName
  table: string | null
  diners: string[]
  cart: CartItem[]
  orderItems: OrderItem[]
  orderStage: OrderStage
  soldOut: string[]
  services: ServiceRequest[]
  paid: boolean
  lastMessage: string
  books: BooksState
}

export type AppAction =
  | { type: 'BIND_TABLE'; table: string }
  | { type: 'SET_VIEW'; view: ViewName }
  | { type: 'ADD_CART'; item: CartItem }
  | { type: 'CHANGE_QTY'; uid: string; delta: number }
  | { type: 'SUBMIT_ORDER' }
  | { type: 'SET_STAGE'; stage: OrderStage }
  | { type: 'TOGGLE_SOLD_OUT'; productId: string }
  | { type: 'CALL_SERVICE'; service: string }
  | { type: 'RESPOND_SERVICES' }
  | { type: 'REQUEST_CANCEL'; uid: string }
  | { type: 'PAY' }
  | { type: 'RESET' }
  | { type: 'SET_MESSAGE'; message: string }
  // 图书管理 actions
  | { type: 'BOOKS_SET_ROLE'; role: BookRole }
  | { type: 'BOOKS_SET_TAB'; tab: BookTab }
  | { type: 'BOOKS_SET_KEYWORD'; keyword: string }
  | { type: 'BOOKS_SET_CATEGORY'; categoryId: string }
  | { type: 'BOOKS_ADD'; input: Omit<Book, 'id' | 'availableStock'> }
  | { type: 'BOOKS_UPDATE'; id: string; patch: Partial<Omit<Book, 'id' | 'availableStock'>> }
  | { type: 'BOOKS_DELETE'; id: string }
  | { type: 'BOOKS_BORROW'; bookId: string; borrowerName?: string }
  | { type: 'BOOKS_RETURN'; recordId?: string; bookId?: string }
  | { type: 'BOOKS_RESET' }
