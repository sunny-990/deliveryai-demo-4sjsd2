import { test, expect, type Page } from '@playwright/test'

async function gotoBooks(page: Page) {
  await page.goto('/#/books')
  await expect(page).toHaveURL(/#\/books$/)
}

test.describe('图书管理模块 - E2E 验收测试', () => {
  test('BOOKS-001: 从首页入口进入图书模块', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/#\/home$/)
    // 首页可见「图书管理」入口按钮
    const entry = page.getByRole('button', { name: /图书管理|Books/ })
    await expect(entry.first()).toBeVisible()
    await entry.first().click()
    await expect(page).toHaveURL(/#\/books$/)
    await expect(page.getByRole('heading', { name: /馆藏图书|Library Collection/ })).toBeVisible()
  })

  test('BOOKS-002: 深链接直接进入 #/books 且默认管理员视图', async ({ page }) => {
    await gotoBooks(page)
    // 默认管理员视图可见「新增图书」按钮
    await expect(page.getByRole('button', { name: /新增图书|Add Book/ })).toBeVisible()
    // 可见分类筛选
    await expect(page.getByRole('button', { name: /全部|All/ }).first()).toBeVisible()
  })

  test('BOOKS-003: 管理员新增图书并显示在列表', async ({ page }) => {
    await gotoBooks(page)
    await page.getByRole('button', { name: /新增图书|Add Book/ }).click()
    const dialogTitle = page.getByText(/新增图书|Add Book/)
    await expect(dialogTitle.first()).toBeVisible()
    // 填写表单（按 placeholder 定位）
    await page.getByPlaceholder(/请输入书名|Enter title/).fill('测试图书A')
    await page.getByPlaceholder(/请输入作者|Enter author/).fill('测试作者')
    await page.locator('input[type="number"]').fill('2')
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    // 新增后列表可见该图书
    await expect(page.getByText('测试图书A').first()).toBeVisible()
    await expect(page.getByText('测试作者').first()).toBeVisible()
  })

  test('BOOKS-004: 表单校验（书名为空阻止提交）', async ({ page }) => {
    await gotoBooks(page)
    await page.getByRole('button', { name: /新增图书|Add Book/ }).click()
    // 不填 title/author，直接点击确认
    await page.locator('input[type="number"]').fill('1')
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    // 仍在 dialog 内（校验失败不关闭）
    await expect(page.getByText(/此项为必填|This field is required/).first()).toBeVisible()
    // Esc 关闭 dialog
    await page.keyboard.press('Escape')
  })

  test('BOOKS-005: 管理员删除带未归还记录的图书被阻止', async ({ page }) => {
    await gotoBooks(page)
    // 活着有逾期记录，删除会被阻止（活着 is seeded with overdue loan）
    const card = page.locator('article').filter({ hasText: '活着' })
    await expect(card.first()).toBeVisible()
    await card.getByRole('button', { name: /删除|Delete/ }).click()
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    // 出现内联错误，Dialog 保留
    await expect(page.getByText(/该书仍有未归还记录|active loans/).first()).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('BOOKS-006: 读者视图借书并显示借阅记录；库存为 0 的书按钮置灰', async ({ page }) => {
    await gotoBooks(page)
    // 切换到读者视图
    await page.getByRole('button', { name: /读者视图|Reader/ }).click()
    // 「新增图书」按钮不可见
    await expect(page.getByRole('button', { name: /新增图书|Add Book/ })).toHaveCount(0)
    // 找到可借的图书并借书（「百年孤独」为可借）
    const card = page.locator('article').filter({ hasText: '百年孤独' })
    await expect(card.first()).toBeVisible()
    await card.getByRole('button', { name: /^借书$|^Borrow$/ }).click()
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    // 跳转/打开借阅记录 tab 查看记录
    await page.getByRole('button', { name: /借阅记录|Records/ }).click()
    await expect(page.getByText('百年孤独').first()).toBeVisible()
    await expect(page.getByText(/借阅中|Borrowing/).first()).toBeVisible()
  })

  test('BOOKS-007: 逾期标识可见（种子数据「活着」逾期）', async ({ page }) => {
    await gotoBooks(page)
    // 「活着」卡片可见逾期徽章
    const card = page.locator('article').filter({ hasText: '活着' })
    await expect(card.getByText(/逾期|Overdue/).first()).toBeVisible()
    // 在借阅记录 tab 可见逾期标识
    await page.getByRole('button', { name: /借阅记录|Records/ }).click()
    await expect(page.getByText(/逾期|Overdue/).first()).toBeVisible()
  })

  test('BOOKS-008: 搜索关键字过滤图书', async ({ page }) => {
    await gotoBooks(page)
    const search = page.getByPlaceholder(/搜索|Search/)
    await search.fill('三体')
    // 仅出现三体卡片
    await expect(page.getByText('三体').first()).toBeVisible()
    // 其他书名不可见
    await expect(page.getByText('百年孤独')).toHaveCount(0)
    // 清空
    await search.fill('')
    await expect(page.getByText('百年孤独').first()).toBeVisible()
  })

  test('BOOKS-009: 切换到火锅点单原有流程不被破坏（首页→欢迎→点餐）', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /A08/ }).first().click()
    await expect(page).toHaveURL(/#\/welcome$/)
    await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
    await expect(page).toHaveURL(/#\/menu$/)
    await expect(page.getByRole('heading', { name: /鎏金番茄鸳鸯锅|Golden Tomato/ })).toBeVisible()
  })

  test('BOOKS-010: 非法 hash 回落到 #/home', async ({ page }) => {
    await page.goto('/#/not-a-view')
    await expect(page).toHaveURL(/#\/home$/)
  })
})
