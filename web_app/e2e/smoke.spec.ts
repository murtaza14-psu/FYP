import { expect, test } from '@playwright/test'

test('app loads with a main landmark', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main')).toBeVisible()
})
