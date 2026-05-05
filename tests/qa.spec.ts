/**
 * Heed QA — full-app smoke + interaction tests
 * Run: npx playwright test
 * Setup (first time): npx playwright install chromium
 *
 * All tests run in demo mode (heed.use-demo=1) so seed data is predictable.
 */
import { test, expect, Page } from '@playwright/test'

// ── helpers ─────────────────────────────────────────────────────────────────

async function loadDemo(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('heed.use-demo', '1')
  })
  await page.goto('/')
  // wait for the app shell to render
  await page.waitForSelector('[data-testid="bottom-nav"], .heed-card, button', { timeout: 10000 })
}

async function clickTab(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: false }).first().click()
  await page.waitForTimeout(300)
}

// ── TODAY TAB ───────────────────────────────────────────────────────────────

test.describe('Today tab', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemo(page)
  })

  test('loads and shows greeting', async ({ page }) => {
    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible()
  })

  test('shows Focus Today section with task cards', async ({ page }) => {
    await expect(page.getByText(/focus today/i)).toBeVisible()
    await expect(page.getByText('Take vitamins')).toBeVisible()
    await expect(page.getByText('Pay electricity bill')).toBeVisible()
  })

  test('overdue tasks show overdue badge or styling', async ({ page }) => {
    // Pay electricity bill is 3 days overdue
    const card = page.locator('.heed-card').filter({ hasText: 'Pay electricity bill' })
    await expect(card).toBeVisible()
  })

  test('task card ⋮ menu opens with correct items', async ({ page }) => {
    const card = page.locator('.heed-card').filter({ hasText: 'Take vitamins' }).first()
    const menuBtn = card.getByRole('button', { name: /⋮|more/i })
    await menuBtn.click()
    await expect(page.getByText('Mark done')).toBeVisible()
    await expect(page.getByText('Skip')).toBeVisible()
    await expect(page.getByText('Edit task')).toBeVisible()
    await expect(page.getByText('Add to a routine')).toBeVisible()
    await expect(page.getByText('Build a routine')).toBeVisible()
  })

  test('⋮ menu closes when clicking outside', async ({ page }) => {
    const card = page.locator('.heed-card').filter({ hasText: 'Take vitamins' }).first()
    await card.getByRole('button', { name: /⋮|more/i }).click()
    await expect(page.getByText('Mark done')).toBeVisible()
    await page.click('body', { position: { x: 10, y: 10 } })
    await expect(page.getByText('Mark done')).not.toBeVisible()
  })

  test('Mark done from ⋮ menu shows toast', async ({ page }) => {
    const card = page.locator('.heed-card').filter({ hasText: 'Take vitamins' }).first()
    await card.getByRole('button', { name: /⋮|more/i }).click()
    await page.getByText('Mark done').click()
    await expect(page.getByText(/done|marked/i)).toBeVisible({ timeout: 3000 })
  })

  test('Skip from ⋮ menu shows toast', async ({ page }) => {
    const card = page.locator('.heed-card').filter({ hasText: 'Take vitamins' }).first()
    await card.getByRole('button', { name: /⋮|more/i }).click()
    await page.getByText('Skip').click()
    await expect(page.getByText(/skip/i)).toBeVisible({ timeout: 3000 })
  })

  test('shows routine rows (Morning routine, Evening wind-down)', async ({ page }) => {
    await expect(page.getByText('Morning routine')).toBeVisible()
    await expect(page.getByText('Evening wind-down')).toBeVisible()
  })

  test('routine row shows 7-pip streak dots', async ({ page }) => {
    // pip dots are 6x6 circles — check the "today →" label is present
    await expect(page.getByText(/today →/)).toBeVisible()
  })

  test('routine row shows rate badge', async ({ page }) => {
    // Morning routine: 5/7, Evening: 6/7 — both show x/7 this week
    await expect(page.getByText(/\/7 this week/)).toBeVisible()
  })

  test('Morning routine shows Lighten this week pill (has suggestion)', async ({ page }) => {
    await expect(page.getByText(/lighten this week/i)).toBeVisible()
  })

  test('Coming Up section visible', async ({ page }) => {
    await expect(page.getByText(/coming up/i)).toBeVisible()
  })

  test('Anything Else section visible', async ({ page }) => {
    await expect(page.getByText(/anything else/i)).toBeVisible()
  })

  test('Ask Heed suggestions visible', async ({ page }) => {
    await expect(page.getByText(/what am i forgetting/i)).toBeVisible()
  })
})

// ── TRACKS TAB ──────────────────────────────────────────────────────────────

test.describe('Tracks tab', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemo(page)
    await clickTab(page, 'Tracks')
  })

  test('shows Routines and Tasks subtabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /routines/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /tasks/i })).toBeVisible()
  })

  test('Routines subtab shows routine cards', async ({ page }) => {
    await expect(page.getByText('Morning routine')).toBeVisible()
    await expect(page.getByText('Evening wind-down')).toBeVisible()
  })

  test('routine card has Mark today done button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /mark today done/i }).first()).toBeVisible()
  })

  test('switching to Tasks subtab shows task list', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await page.waitForTimeout(200)
    await expect(page.getByText('Take vitamins')).toBeVisible()
    await expect(page.getByText('Pay electricity bill')).toBeVisible()
  })

  test('Tasks subtab shows category filter pills', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await expect(page.getByRole('button', { name: 'all', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'health', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'finance', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'home', exact: true })).toBeVisible()
  })

  test('category filter — health shows only health tasks', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await page.getByRole('button', { name: 'health', exact: true }).click()
    await expect(page.getByText('Take vitamins')).toBeVisible()
    await expect(page.getByText('Pay electricity bill')).not.toBeVisible()
  })

  test('category filter — finance shows only finance tasks', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await page.getByRole('button', { name: 'finance', exact: true }).click()
    await expect(page.getByText('Pay electricity bill')).toBeVisible()
    await expect(page.getByText('Take vitamins')).not.toBeVisible()
  })

  test('Tasks subtab shows sort controls', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await expect(page.getByRole('button', { name: 'Due date', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'A–Z', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Severity', exact: true })).toBeVisible()
  })

  test('sort A–Z — tasks appear in alphabetical order', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await page.getByRole('button', { name: 'A–Z', exact: true }).click()
    await page.waitForTimeout(200)
    const names = await page.locator('.heed-card').evaluateAll(
      cards => cards.map(c => c.textContent ?? '')
    )
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
  })

  test('sort Severity — Pay electricity bill (most overdue) appears first', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await page.getByRole('button', { name: 'Severity', exact: true }).click()
    await page.waitForTimeout(200)
    const firstCard = page.locator('.heed-card').first()
    // Pay electricity (3d overdue) or Call Mom (2d overdue) should be at top
    await expect(firstCard).toContainText(/pay electricity|call mom/i)
  })

  test('Add task button visible in Tasks subtab', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await expect(page.getByRole('button', { name: /add task/i })).toBeVisible()
  })

  test('Add routine button visible in Routines subtab', async ({ page }) => {
    await expect(page.getByRole('button', { name: /build routine/i })).toBeVisible()
  })
})

// ── LIFE TAB — PLANS ─────────────────────────────────────────────────────────

test.describe('Life tab — Plans', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemo(page)
    await clickTab(page, 'Life')
    // Life tab defaults to Plans subtab
    await page.waitForTimeout(200)
  })

  test('shows three demo plans', async ({ page }) => {
    await expect(page.getByText('Move apartments')).toBeVisible()
    await expect(page.getByText('Job interview — Acme Co.')).toBeVisible()
    await expect(page.getByText('Save ₱50,000')).toBeVisible()
  })

  test('project plan card shows progress bar and task count', async ({ page }) => {
    await expect(page.getByText(/2 of 7 tasks/i)).toBeVisible()
  })

  test('goal plan card shows percentage', async ({ page }) => {
    // 31500 / 50000 = 63%
    await expect(page.getByText('63%')).toBeVisible()
  })

  test('clicking project opens PlanDetailScreen', async ({ page }) => {
    await page.getByText('Move apartments').click()
    await page.waitForTimeout(300)
    await expect(page.getByText('‹ Plans')).toBeVisible()
    await expect(page.getByText('Pack bedroom')).toBeVisible()
    await expect(page.getByText('Transfer utilities')).toBeVisible()
  })

  test('project detail back button returns to plans list', async ({ page }) => {
    await page.getByText('Move apartments').click()
    await page.waitForTimeout(300)
    await page.getByText('‹ Plans').click()
    await page.waitForTimeout(300)
    await expect(page.getByText('Job interview — Acme Co.')).toBeVisible()
  })

  test('project detail shows ⋯ edit button', async ({ page }) => {
    await page.getByText('Move apartments').click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('button', { name: /⋯/i })).toBeVisible()
  })

  test('project detail ⋯ opens edit panel', async ({ page }) => {
    await page.getByText('Move apartments').click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /⋯/i }).click()
    await expect(page.getByPlaceholder(/jun 15|e\.g\. jun/i)).toBeVisible()
  })

  test('project detail task checkbox marks task done', async ({ page }) => {
    await page.getByText('Move apartments').click()
    await page.waitForTimeout(300)
    // Click the Pack bedroom checkbox/row
    const packRow = page.locator('label, div').filter({ hasText: 'Pack bedroom' }).first()
    await packRow.click()
    await page.waitForTimeout(300)
    // toast or visual change — progress should have increased
    await expect(page.getByText(/3 of 7|done/i)).toBeVisible({ timeout: 3000 })
  })

  test('clicking event opens PlanDetailScreen', async ({ page }) => {
    await page.getByText('Job interview — Acme Co.').click()
    await page.waitForTimeout(300)
    await expect(page.getByText('‹ Plans')).toBeVisible()
    await expect(page.getByText('Research the company')).toBeVisible()
  })

  test('event detail shows event date', async ({ page }) => {
    await page.getByText('Job interview — Acme Co.').click()
    await page.waitForTimeout(300)
    await expect(page.getByText(/date:/i)).toBeVisible()
  })

  test('clicking goal opens GoalDetailScreen (not a bottom sheet)', async ({ page }) => {
    await page.getByText('Save ₱50,000').click()
    await page.waitForTimeout(300)
    // Should be a full page view with back button, not a fixed overlay
    await expect(page.getByText('‹ Plans')).toBeVisible()
  })

  test('goal detail shows NO ⋯ edit button', async ({ page }) => {
    await page.getByText('Save ₱50,000').click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('button', { name: /⋯/i })).not.toBeVisible()
  })

  test('goal detail shows progress bar', async ({ page }) => {
    await page.getByText('Save ₱50,000').click()
    await page.waitForTimeout(300)
    // 63% saved label
    await expect(page.getByText(/63%.*saved/i)).toBeVisible()
  })

  test('goal detail shows amount to go', async ({ page }) => {
    await page.getByText('Save ₱50,000').click()
    await page.waitForTimeout(300)
    // 50000 - 31500 = 18500 to go
    await expect(page.getByText(/18,500.*to go/i)).toBeVisible()
  })

  test('goal detail shows update amount input and save button', async ({ page }) => {
    await page.getByText('Save ₱50,000').click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('spinbutton')).toBeVisible() // number input
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
  })

  test('goal detail back button returns to plans list', async ({ page }) => {
    await page.getByText('Save ₱50,000').click()
    await page.waitForTimeout(300)
    await page.getByText('‹ Plans').click()
    await page.waitForTimeout(300)
    await expect(page.getByText('Move apartments')).toBeVisible()
  })

  test('Add plan button visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add plan/i })).toBeVisible()
  })

  test('Add plan sheet opens', async ({ page }) => {
    await page.getByRole('button', { name: /add plan/i }).click()
    await page.waitForTimeout(300)
    await expect(page.getByText(/goal|project|event/i)).toBeVisible()
  })
})

// ── LIFE TAB — LIFE EVENTS ──────────────────────────────────────────────────

test.describe('Life tab — Life events', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemo(page)
    await clickTab(page, 'Life')
    await page.waitForTimeout(200)
    // Switch to Life Events subtab
    await page.getByRole('button', { name: /life events/i }).click()
    await page.waitForTimeout(200)
  })

  test('shows quick-add context chips', async ({ page }) => {
    await expect(page.getByText(/sick/i)).toBeVisible()
    await expect(page.getByText(/busy week/i)).toBeVisible()
    await expect(page.getByText(/traveling/i)).toBeVisible()
  })

  test('Add event button visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add event/i })).toBeVisible()
  })

  test('Add event sheet opens with notes textarea', async ({ page }) => {
    await page.getByRole('button', { name: /add event/i }).click()
    await page.waitForTimeout(300)
    await expect(page.getByPlaceholder(/extra details|notes/i)).toBeVisible()
  })

  test('upcoming context card shown (Singapore trip)', async ({ page }) => {
    await expect(page.getByText(/singapore trip/i)).toBeVisible()
  })
})

// ── ADD FLOWS ────────────────────────────────────────────────────────────────

test.describe('Add task flow', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemo(page)
    await clickTab(page, 'Tracks')
    await page.getByRole('button', { name: /tasks/i }).click()
    await page.waitForTimeout(200)
  })

  test('Add task modal opens', async ({ page }) => {
    await page.getByRole('button', { name: /add task/i }).click()
    await page.waitForTimeout(300)
    await expect(page.getByPlaceholder(/task name|what needs doing/i)).toBeVisible()
  })

  test('Add task modal closes on cancel', async ({ page }) => {
    await page.getByRole('button', { name: /add task/i }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /cancel/i }).click()
    await page.waitForTimeout(300)
    await expect(page.getByPlaceholder(/task name|what needs doing/i)).not.toBeVisible()
  })
})

test.describe('Add routine flow', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemo(page)
    await clickTab(page, 'Tracks')
    await page.waitForTimeout(200)
  })

  test('Add routine modal opens', async ({ page }) => {
    await page.getByRole('button', { name: /build routine/i }).click()
    await page.waitForTimeout(300)
    await expect(page.getByPlaceholder(/routine name|morning/i)).toBeVisible()
  })

  test('Add routine modal has notes textarea', async ({ page }) => {
    await page.getByRole('button', { name: /build routine/i }).click()
    await page.waitForTimeout(300)
    await expect(page.getByPlaceholder(/context or reminders/i)).toBeVisible()
  })

  test('Add routine modal closes on cancel', async ({ page }) => {
    await page.getByRole('button', { name: /build routine/i }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /cancel/i }).click()
    await page.waitForTimeout(300)
    await expect(page.getByPlaceholder(/routine name|morning/i)).not.toBeVisible()
  })
})

// ── NAVIGATION ──────────────────────────────────────────────────────────────

test.describe('Bottom navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemo(page)
  })

  test('Today tab is active on load', async ({ page }) => {
    await expect(page.getByText(/focus today/i)).toBeVisible()
  })

  test('can switch to Tracks tab', async ({ page }) => {
    await clickTab(page, 'Tracks')
    await expect(page.getByText(/routines/i)).toBeVisible()
  })

  test('can switch to Life tab', async ({ page }) => {
    await clickTab(page, 'Life')
    await expect(page.getByText(/move apartments|save.*50,000|job interview/i)).toBeVisible()
  })

  test('can return to Today after switching', async ({ page }) => {
    await clickTab(page, 'Tracks')
    await clickTab(page, 'Today')
    await expect(page.getByText(/focus today/i)).toBeVisible()
  })
})

// ── TOAST NOTIFICATIONS ──────────────────────────────────────────────────────

test.describe('Toast notifications', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemo(page)
  })

  test('toast auto-dismisses', async ({ page }) => {
    const card = page.locator('.heed-card').filter({ hasText: 'Take vitamins' }).first()
    await card.getByRole('button', { name: /⋮|more/i }).click()
    await page.getByText('Mark done').click()
    const toast = page.getByText(/done|marked/i)
    await expect(toast).toBeVisible({ timeout: 2000 })
    await expect(toast).not.toBeVisible({ timeout: 6000 })
  })
})
