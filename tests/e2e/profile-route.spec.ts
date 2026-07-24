import { expect, test } from "@playwright/test"

test("directly loading /profile resolves without a 404", async ({ page }) => {
  const response = await page.goto("/profile")

  expect(response?.status()).toBe(200)
  await expect(page).not.toHaveTitle(/404/i)
  await expect(page.getByText("This page could not be found.")).toHaveCount(0)
})
