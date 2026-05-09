import { test, expect, Page } from '@playwright/test'

async function loadCalendar(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('heed.use-demo', '1')
    localStorage.setItem('heed.username', 'demo')
  })
  await page.goto('/')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /calendar/i }).first().click()
  await page.waitForTimeout(300)
}

test.describe('Calendar inline task detail', () => {
  test('tapping a task chip opens an inline detail card under its row', async ({ page }) => {
    await loadCalendar(page)

    const chip = page.locator('[data-task-chip]').first()
    await expect(chip).toBeVisible()
    await chip.click()

    const card = page.getByTestId('inline-task-detail')
    await expect(card).toBeVisible()
    await expect(card.getByText(/Mark done/i)).toBeVisible()
    await expect(card.getByText(/Skip/i)).toBeVisible()
    await expect(card.getByText(/Reschedule to/i)).toBeVisible()
  })

  test('tapping the same chip again closes the card', async ({ page }) => {
    await loadCalendar(page)
    const chip = page.locator('[data-task-chip]').first()
    await chip.click()
    await expect(page.getByTestId('inline-task-detail')).toBeVisible()
    await chip.click()
    await expect(page.getByTestId('inline-task-detail')).toHaveCount(0)
  })

  test('tapping outside the card closes it', async ({ page }) => {
    await loadCalendar(page)
    await page.locator('[data-task-chip]').first().click()
    await expect(page.getByTestId('inline-task-detail')).toBeVisible()
    // Click the month/year header in the MonthStrip — outside any chip or card.
    await page.locator('text=/Week of/i').first().click({ force: true })
    await expect(page.getByTestId('inline-task-detail')).toHaveCount(0)
  })

  test('inline card is not position:fixed (no overlay sheet)', async ({ page }) => {
    await loadCalendar(page)
    await page.locator('[data-task-chip]').first().click()
    const card = page.getByTestId('inline-task-detail')
    await expect(card).toBeVisible()
    const position = await card.evaluate(el => getComputedStyle(el).position)
    expect(position).not.toBe('fixed')
  })
})
