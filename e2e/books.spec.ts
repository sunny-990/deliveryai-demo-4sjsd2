import { test, expect, type Page } from '@playwright/test'

async function gotoBooks(page: Page) {
  await page.goto('/#/books', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/#\/books$/, { timeout: 20000 })
  // 等待核心内容挂载
  await expect(page.getByRole('heading', { name: /馆藏图书|Library Collection/ })).toBeVisible()
}

/** 在图书列表中根据书名定位一张卡片 */
function bookCard(page: Page, title: string) {
  return page.locator('article').filter({ hasText: title }).first()
}

test.describe('图书管理模块 - E2E 验收测试', () => {
  test('BOOKS-001: 从首页入口进入图书模块', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/#\/home$/)
    const entry = page.getByRole('button', { name: /图书管理|Books/ })
    await expect(entry.first()).toBeVisible()
    await entry.first().click()
    await page.waitForURL(/#\/books$/, { timeout: 20000 })
    await expect(page.getByRole('heading', { name: /馆藏图书|Library Collection/ })).toBeVisible()
  })

  test('BOOKS-002: 深链接直接进入 #/books 且默认管理员视图', async ({ page }) => {
    await gotoBooks(page)
    await expect(page.getByRole('button', { name: /新增图书|Add Book/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /全部|All/ }).first()).toBeVisible()
  })

  test('BOOKS-003: 管理员新增图书并显示在列表', async ({ page }) => {
    await gotoBooks(page)
    await page.getByRole('button', { name: /新增图书|Add Book/ }).click()
    await expect(page.getByText(/新增图书|Add Book/).first()).toBeVisible()
    await page.getByPlaceholder(/请输入书名|Enter title/).fill('测试图书A')
    await page.getByPlaceholder(/请输入作者|Enter author/).fill('测试作者')
    await page.locator('input[type="number"]').fill('2')
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    await expect(bookCard(page, '测试图书A')).toBeVisible()
    await expect(bookCard(page, '测试图书A').getByText(/在馆|In Stock/)).toBeVisible()
    await expect(bookCard(page, '测试图书A').getByText(/2.*\/.*2/)).toBeVisible()
  })

  test('BOOKS-004: 表单校验（书名为空阻止提交）', async ({ page }) => {
    await gotoBooks(page)
    await page.getByRole('button', { name: /新增图书|Add Book/ }).click()
    await page.locator('input[type="number"]').fill('1')
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    await expect(page.getByText(/此项为必填|This field is required/).first()).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('BOOKS-005: 管理员删除带未归还记录的图书被阻止', async ({ page }) => {
    await gotoBooks(page)
    // 「活着」种子数据中有一笔逾期未归还记录，删除应被阻止
    const card = bookCard(page, '活着')
    await card.getByRole('button', { name: /删除|Delete/ }).click()
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    await expect(page.getByText(/该书仍有未归还记录|active loans/).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(bookCard(page, '活着')).toBeVisible()
  })

  test('BOOKS-006: 读者视图借书并生成借阅记录', async ({ page }) => {
    await gotoBooks(page)
    await page.getByRole('button', { name: /读者视图|Reader/ }).click()
    await expect(page.getByRole('button', { name: /新增图书|Add Book/ })).toHaveCount(0)
    const card = bookCard(page, '百年孤独')
    await card.getByRole('button', { name: /^借书$|^Borrow$/ }).click()
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    await page.getByRole('button', { name: /借阅记录|Records/ }).click()
    await expect(page.getByText('百年孤独').first()).toBeVisible()
    await expect(page.getByText(/借阅中|Borrowing/).first()).toBeVisible()
  })

  test('BOOKS-007: 逾期标识可见（种子数据「活着」逾期）', async ({ page }) => {
    await gotoBooks(page)
    const card = bookCard(page, '活着')
    await expect(card.getByText(/逾期|Overdue/).first()).toBeVisible()
    await page.getByRole('button', { name: /借阅记录|Records/ }).click()
    await expect(page.getByText(/逾期|Overdue/).first()).toBeVisible()
  })

  test('BOOKS-008: 搜索关键字过滤图书', async ({ page }) => {
    await gotoBooks(page)
    const search = page.getByPlaceholder(/搜索|Search/)
    await search.fill('三体')
    await expect(bookCard(page, '三体')).toBeVisible()
    await expect(page.getByText('百年孤独')).toHaveCount(0)
    await search.fill('')
    await expect(bookCard(page, '百年孤独')).toBeVisible()
  })

  test('BOOKS-009: 火锅点单入口流程（首页→欢迎→点餐）不被破坏', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /A08/ }).first().click()
    await expect(page).toHaveURL(/#\/welcome$/)
    await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
    await expect(page).toHaveURL(/#\/menu$/)
    await expect(page.getByRole('heading', { name: /鎏金番茄鸳鸯锅|Golden Tomato/ })).toBeVisible()
  })

  test('BOOKS-010: 非法 hash 回落到 #/home', async ({ page }) => {
    await page.goto('/#/not-a-view', { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/#\/home$/, { timeout: 20000 })
  })

  test('BOOKS-011: 管理员编辑图书信息并保存', async ({ page }) => {
    await gotoBooks(page)
    const card = bookCard(page, '算法导论')
    await card.getByRole('button', { name: /编辑|Edit/ }).click()
    await expect(page.getByText(/编辑图书|Edit Book/).first()).toBeVisible()
    const titleInput = page.getByPlaceholder(/请输入书名|Enter title/)
    await titleInput.fill('算法导论（第3版）')
    await page.locator('input[type="number"]').fill('5')
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    await expect(bookCard(page, '算法导论（第3版）')).toBeVisible()
    await expect(bookCard(page, '算法导论（第3版）').getByText(/5.*\/.*5/)).toBeVisible()
  })

  test('BOOKS-012: 管理员删除无借阅记录的图书成功', async ({ page }) => {
    await gotoBooks(page)
    await page.getByRole('button', { name: /新增图书|Add Book/ }).click()
    await page.getByPlaceholder(/请输入书名|Enter title/).fill('待删除图书')
    await page.getByPlaceholder(/请输入作者|Enter author/).fill('临时作者')
    await page.locator('input[type="number"]').fill('1')
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    const card = bookCard(page, '待删除图书')
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: /删除|Delete/ }).click()
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    // 删除成功 toast 出现
    await expect(page.getByText(/已删除|Deleted/).first()).toBeVisible()
    // 断言列表 article 里不再有"待删除图书"（排除 toast 等其它文本容器）
    await expect(page.locator('article').filter({ hasText: '待删除图书' })).toHaveCount(0)
  })

  test('BOOKS-013: 分类筛选只显示对应分类图书', async ({ page }) => {
    await gotoBooks(page)
    await page.getByRole('button', { name: /^科技$|^Tech$/ }).click()
    await expect(bookCard(page, '算法导论')).toBeVisible()
    await expect(bookCard(page, '代码整洁之道')).toBeVisible()
    await expect(page.locator('article').filter({ hasText: '百年孤独' })).toHaveCount(0)
    await page.getByRole('button', { name: /^全部$|^All$/ }).first().click()
    await expect(bookCard(page, '百年孤独')).toBeVisible()
  })

  test('BOOKS-014: 读者借书后还书，记录归入历史、可借数恢复', async ({ page }) => {
    await gotoBooks(page)
    await page.getByRole('button', { name: /读者视图|Reader/ }).click()
    const card = bookCard(page, '小王子')
    await card.getByRole('button', { name: /^借书$|^Borrow$/ }).click()
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    await expect(bookCard(page, '小王子').getByText(/3.*\/.*4/)).toBeVisible()
    await page.getByRole('button', { name: /借阅记录|Records/ }).click()
    // 在借阅记录 tab 下，找到包含「小王子」的活动记录行（即包含还书按钮的那一行）
    const activeHeading = page.locator('h2').filter({ hasText: /借阅中|Active Loans/ })
    const xiaowangziRow = activeHeading.locator('xpath=following-sibling::div[1]').locator('div.rounded-2xl').filter({ hasText: '小王子' }).first()
    await expect(xiaowangziRow).toBeVisible()
    await expect(xiaowangziRow.getByText(/借阅中|Borrowing/)).toBeVisible()
    await xiaowangziRow.getByRole('button', { name: /还书|Return/ }).click()
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    // 历史区出现已归还记录
    await expect(page.getByText(/已归还|Returned/).first()).toBeVisible()
    await page.getByRole('button', { name: /图书列表|Books/ }).click()
    await expect(bookCard(page, '小王子').getByText(/4.*\/.*4/)).toBeVisible()
  })

  test('BOOKS-015: 可借数为 0 的图书借书按钮置灰并显示暂无库存', async ({ page }) => {
    await gotoBooks(page)
    await page.getByRole('button', { name: /读者视图|Reader/ }).click()
    const card = bookCard(page, '万历十五年')
    const borrowBtn = card.getByRole('button', { name: /暂无库存|Out of stock/ })
    await expect(borrowBtn).toBeVisible()
    await expect(borrowBtn).toBeDisabled()
  })

  test('BOOKS-016: 切换到英文后图书模块文案显示英文', async ({ page }) => {
    await gotoBooks(page)
    // 中文下语言按钮显示 "EN"
    // 语言按钮带 aria-label="切换语言"，内部文本随当前语言变化（zh 下显示 EN，en 下显示 "中"）
    const langBtn = page.getByRole('button', { name: /切换语言|Switch language/ })
    await langBtn.filter({ hasText: 'EN' }).click()
    // 等待按钮文本变为"中"，确认 language 状态已切换为 en
    await expect(langBtn.filter({ hasText: '中' })).toBeVisible()
    // i18next 的重渲染是异步的，再额外等下一帧
    await page.waitForTimeout(300)
    await expect(page.getByRole('heading', { name: 'Library Collection' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Book' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Admin' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reader' })).toBeVisible()
    await expect(page.getByPlaceholder('Search title, author or ISBN')).toBeVisible()
    // 切回中文
    await langBtn.filter({ hasText: '中' }).click()
    await expect(page.getByRole('heading', { name: '馆藏图书' })).toBeVisible()
  })

  test('BOOKS-017: 刷新页面后图书数据重置为初始 Mock 状态', async ({ page }) => {
    await gotoBooks(page)
    await page.getByRole('button', { name: /读者视图|Reader/ }).click()
    const card = bookCard(page, '小王子')
    await card.getByRole('button', { name: /^借书$|^Borrow$/ }).click()
    await page.getByRole('button', { name: /^确认$|^Confirm$/ }).click()
    await expect(bookCard(page, '小王子').getByText(/3.*\/.*4/)).toBeVisible()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForURL(/#\/books$/, { timeout: 20000 })
    await expect(page.getByRole('heading', { name: /馆藏图书|Library Collection/ })).toBeVisible()
    await expect(bookCard(page, '小王子').getByText(/4.*\/.*4/)).toBeVisible()
  })

  test('BOOKS-018: 火锅点单可完成最小点菜并进入订单/结账视图（回归保护）', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /A08/ }).first().click()
    await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
    await expect(page).toHaveURL(/#\/menu$/)
    // 选锅底分类 → 选第一个锅底 → 微辣（无弹窗）→ 加入购物车
    await page.getByRole('button', { name: '锅底' }).click()
    const productCards = page.locator('article')
    await productCards.first().locator('button').last().click()
    await page.getByRole('button', { name: '微辣' }).click()
    await page.getByRole('button', { name: '加入本桌购物车' }).click()
    // 桌面右侧 CartPanel 提交订单
    await page.getByRole('button', { name: /确认并提交订单|Confirm \& Submit Order/ }).click()
    // 进入订单页
    await page.getByRole('button', { name: /订单|Orders/ }).first().click()
    await expect(page).toHaveURL(/#\/order$/)
    await page.getByRole('button', { name: /去结账|Checkout/ }).first().click()
    await expect(page).toHaveURL(/#\/checkout$/)
  })
})
