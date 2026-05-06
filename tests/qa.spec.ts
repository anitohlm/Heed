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
    localStorage.setItem('heed.username', 'demo')
  })
  await page.goto('/')
  await page.waitForTimeout(500)
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
    // Greeting format: "Morning/Afternoon/Evening/Late evening/Late night, demo."
    await expect(page.getByText(/^(late night|late evening|morning|afternoon|evening),/i)).toBeVisible()
  })

  test('shows Focus Today section with task cards', async ({ page }) => {
    await expect(page.getByText(/focus today/i)).toBeVisible()
    await expect(page.getByText('Take vitamins')).toBeVisible()
    await expect(page.getByText('Pay electricity bill')).toBeVisible()
  })

  test('focus task row has mark-done button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /mark "take vitamins" done/i })).toBeVisible()
  })

  test('clicking mark-done button shows toast', async ({ page }) => {
    await page.getByRole('button', { name: /mark "take vitamins" done/i }).click()
    await expect(page.getByText(/marked done/)).toBeVisible({ timeout: 3000 })
  })

  test('shows routine rows (Morning routine, Evening wind-down)', async ({ page }) => {
    await expect(page.getByText('Morning routine')).toBeVisible()
    await expect(page.getByText('Evening wind-down')).toBeVisible()
  })

  test('routine row shows rate badge', async ({ page }) => {
    await expect(page.getByText(/\d+\/7 this week/).first()).toBeVisible()
  })

  test('Morning routine shows Lighten this week pill when expanded', async ({ page }) => {
    await page.getByRole('button', { name: /expand morning routine/i }).click()
    await page.waitForTimeout(200)
    await expect(page.getByText(/lighten this week/i)).toBeVisible()
  })

  test('Anything Else section visible', async ({ page }) => {
    await expect(page.getByText(/anything else/i)).toBeVisible()
  })

  test('upcoming Singapore trip context card shown', async ({ page }) => {
    await expect(page.getByText(/singapore trip/i)).toBeVisible()
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

  test('sort A–Z — Call Mom appears before Take vitamins', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await page.getByRole('button', { name: 'A–Z', exact: true }).click()
    await page.waitForTimeout(200)
    const allText = await page.locator('.heed-card').allTextContents()
    const callIdx = allText.findIndex(t => /call mom/i.test(t))
    const vitIdx = allText.findIndex(t => /take vitamins/i.test(t))
    expect(callIdx).toBeGreaterThanOrEqual(0)
    expect(vitIdx).toBeGreaterThanOrEqual(0)
    expect(callIdx).toBeLessThan(vitIdx)
  })

  test('sort Severity — task list changes order from default', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await page.waitForTimeout(200)
    const defaultOrder = await page.locator('.heed-card').allTextContents()
    await page.getByRole('button', { name: 'Severity', exact: true }).click()
    await page.waitForTimeout(200)
    const severityOrder = await page.locator('.heed-card').allTextContents()
    // Severity sort should produce a different ordering than the default
    expect(severityOrder).not.toEqual(defaultOrder)
  })

  test('task card ⋮ menu opens with correct items', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await page.waitForTimeout(200)
    await page.locator('[aria-label="Task options"]').first().click()
    await expect(page.getByRole('button', { name: 'Mark done' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit task' })).toBeVisible()
  })

  test('⋮ menu closes when clicking outside', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await page.waitForTimeout(200)
    await page.locator('[aria-label="Task options"]').first().click()
    await expect(page.locator('[data-testid="task-menu"]')).toBeVisible()
    // The backdrop uses position:fixed inside a stacking context — Playwright's
    // coordinate-based mouse.click can't reach it reliably, so dispatch directly
    await page.locator('[data-testid="task-backdrop"]').dispatchEvent('click')
    await expect(page.locator('[data-testid="task-menu"]')).not.toBeVisible()
  })

  test('Mark done from ⋮ menu shows toast', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await page.waitForTimeout(200)
    await page.locator('[aria-label="Task options"]').first().click()
    // dispatchEvent bypasses Playwright's coordinate-based routing so the backdrop
    // (position:fixed inside the card's stacking context) doesn't intercept
    await page.locator('[data-testid="task-menu"]').getByRole('button', { name: 'Mark done' }).dispatchEvent('click')
    await expect(page.getByText(/marked done/)).toBeVisible({ timeout: 3000 })
  })

  test('Skip from ⋮ menu shows toast', async ({ page }) => {
    await page.getByRole('button', { name: /tasks/i }).click()
    await page.waitForTimeout(200)
    await page.locator('[aria-label="Task options"]').first().click()
    await page.locator('[data-testid="task-menu"]').getByRole('button', { name: 'Skip' }).dispatchEvent('click')
    await expect(page.getByText(/skipped/)).toBeVisible({ timeout: 3000 })
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

  test('project detail shows Edit plan button', async ({ page }) => {
    await page.getByText('Move apartments').click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('button', { name: 'Edit plan' })).toBeVisible()
  })

  test('project detail Edit plan button opens edit panel', async ({ page }) => {
    await page.getByText('Move apartments').click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Edit plan' }).click()
    await expect(page.getByPlaceholder(/jun 15|e\.g\. jun/i)).toBeVisible()
  })

  test('project detail task checkbox marks task done', async ({ page }) => {
    await page.getByText('Move apartments').click()
    await page.waitForTimeout(300)
    const packRow = page.locator('label, div').filter({ hasText: 'Pack bedroom' }).first()
    await packRow.click()
    await page.waitForTimeout(300)
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
    await expect(page.getByText('‹ Plans')).toBeVisible()
  })

  test('goal detail shows NO Edit plan button', async ({ page }) => {
    await page.getByText('Save ₱50,000').click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('button', { name: 'Edit plan' })).not.toBeVisible()
  })

  test('goal detail shows progress bar', async ({ page }) => {
    await page.getByText('Save ₱50,000').click()
    await page.waitForTimeout(300)
    await expect(page.getByText(/63%.*saved/i)).toBeVisible()
  })

  test('goal detail shows amount to go', async ({ page }) => {
    await page.getByText('Save ₱50,000').click()
    await page.waitForTimeout(300)
    await expect(page.getByText(/18,500.*to go/i)).toBeVisible()
  })

  test('goal detail shows update amount input and save button', async ({ page }) => {
    await page.getByText('Save ₱50,000').click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('spinbutton')).toBeVisible()
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

  test('Add plan sheet opens with plan type options', async ({ page }) => {
    await page.getByRole('button', { name: /add plan/i }).click()
    await page.waitForTimeout(300)
    // Sheet opens showing Project / Goal / Event type buttons
    await expect(page.getByRole('button', { name: /📦.*project/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /🎯.*goal/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /📅.*event/i })).toBeVisible()
  })
})

// ── LIFE TAB — LIFE EVENTS ──────────────────────────────────────────────────

test.describe('Life tab — Life events', () => {
  test.beforeEach(async ({ page }) => {
    await loadDemo(page)
    await clickTab(page, 'Life')
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: /life events/i }).click()
    await page.waitForTimeout(200)
  })

  test('shows quick-add context chips', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sick/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /busy week/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /traveling/i })).toBeVisible()
  })

  test('Add event button visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add event/i })).toBeVisible()
  })

  test('Add event sheet opens with notes textarea', async ({ page }) => {
    await page.getByRole('button', { name: /add event/i }).click()
    await page.waitForTimeout(300)
    await expect(page.getByPlaceholder(/extra details|notes/i)).toBeVisible()
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
    await expect(page.getByPlaceholder(/clean the aircon/i)).toBeVisible()
  })

  test('Add task modal closes on cancel', async ({ page }) => {
    await page.getByRole('button', { name: /add task/i }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /cancel/i }).click()
    await page.waitForTimeout(300)
    await expect(page.getByPlaceholder(/clean the aircon/i)).not.toBeVisible()
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

  test('Add routine modal closes on Escape', async ({ page }) => {
    await page.getByRole('button', { name: /build routine/i }).click()
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
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
    await expect(page.getByText('Move apartments')).toBeVisible()
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
    await page.getByRole('button', { name: /mark "take vitamins" done/i }).click()
    const toast = page.getByText(/marked done/)
    await expect(toast).toBeVisible({ timeout: 2000 })
    await expect(toast).not.toBeVisible({ timeout: 6000 })
  })
})

// ── SETTINGS AVATAR ──────────────────────────────────────────────────────────

test.describe('Settings avatar', () => {
  // A 1×1 JPEG encoded as data URL — used to seed localStorage before load
  const FIXTURE_AVATAR =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/wAARCAABAAEDASIAAhEBAxEB/' +
    '8QAFgABAQEAAAAAAAAAAAAAAAAABgUEB/8QAIRAAAQQCAgMBAAAAAAAAAAAAAQIDBBEFITFBUWH/' +
    'xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A' +
    'w2yk5VjDJvgO0sMM0ORQxBJSoEBwHkEglAJgMklKJvkAB//Z'

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((url) => {
      localStorage.setItem('heed.use-demo', '1')
      localStorage.setItem('heed.username', 'demo')
      localStorage.setItem('heed.avatar', url)
    }, FIXTURE_AVATAR)
    await page.goto('/')
    await page.waitForTimeout(500)
  })

  test('AvatarButton renders img element when avatar is seeded', async ({ page }) => {
    const img = page.locator('header img[alt="avatar"]').first()
    await expect(img).toBeVisible()
  })

  test('Settings sheet shows tappable avatar circle', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).first().click()
    await page.waitForTimeout(300)
    await expect(page.locator('[aria-label="Change avatar"]')).toBeVisible()
  })

  test('Settings sheet shows camera badge', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).first().click()
    await page.waitForTimeout(300)
    await expect(page.getByText('📷')).toBeVisible()
  })

  test('hidden file input exists in settings sheet', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).first().click()
    await page.waitForTimeout(300)
    await expect(page.locator('input[type="file"][accept="image/*"]')).toBeAttached()
  })

  test('Settings sheet avatar circle shows img when avatar is set', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).first().click()
    await page.waitForTimeout(300)
    await expect(page.locator('.heed-settings-avatar img')).toBeVisible()
  })
})
