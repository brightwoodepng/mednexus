import { expect, test } from "@playwright/test"

async function enterAsGuest(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Continue as guest" }).click()
  await page.getByLabel("Your name").fill("Navigation Tester")
  await page.getByRole("button", { name: /continue/i }).click()
  const welcome = page.getByRole("button", { name: /start learning/i })
  if (await welcome.isVisible()) await welcome.click()
}

test("directly loading /profile resolves without a 404", async ({ page }) => {
  const response = await page.goto("/profile")

  expect(response?.status()).toBe(200)
  await expect(page).not.toHaveTitle(/404/i)
  await expect(page.getByText("This page could not be found.")).toHaveCount(0)
})

test("Profile to Dashboard navigation survives refresh and browser history", async ({ page }) => {
  await enterAsGuest(page)

  await page.getByRole("button", { name: "Open account menu" }).click()
  await page.getByRole("menuitem", { name: "Profile & account" }).click()
  await expect(page).toHaveURL(/\/profile\?hub=mcq$/)

  await page.getByRole("button", { name: "Dashboard", exact: true }).first().click()
  await expect(page).not.toHaveURL(/\/profile(?:\?|$)/)
  await expect(page).toHaveURL(/\/\?hub=mcq$/)

  await page.reload()
  await expect(page.getByRole("heading", { name: /good (morning|afternoon|evening)/i })).toBeVisible()
  await expect(page).toHaveURL(/\/\?hub=mcq$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/profile\?hub=mcq$/)
  await expect(page.getByText("Profile & Settings")).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(/\/\?hub=mcq$/)
  await expect(page.getByRole("heading", { name: /good (morning|afternoon|evening)/i })).toBeVisible()
})
