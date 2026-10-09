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

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`profile sections fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await enterAsGuest(page)
    await page.getByRole("button", { name: "Open account menu" }).click()
    await page.getByRole("menuitem", { name: "Profile & account" }).click()
    const sections = page.getByRole("navigation", { name: "Profile sections" })
    const expectContentToFit = async () => {
      const overflow = await page.locator("main").evaluate((main) => {
        const bounds = main.getBoundingClientRect()
        return Array.from(main.querySelectorAll<HTMLElement>("button, input, article, section, nav, h1, h2, h3, p")).filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)
        }).map((element) => element.textContent?.slice(0, 80))
      })
      expect(overflow).toEqual([])
    }

    await expect(sections).toBeVisible()
    await expectContentToFit()
    await page.getByText("View all 12 clinical ranks", { exact: true }).click()
    await expectContentToFit()
    await page.getByLabel("Edit name", { exact: true }).click()
    await page.getByLabel("Display name", { exact: true }).fill("VeryLongUnbrokenProfileNameForResponsiveLayoutTesting")
    await page.getByLabel("Save name", { exact: true }).click()
    await expect(page.getByRole("heading", { name: "VeryLongUnbrokenProfileNameForResponsiveLayoutTesting" })).toBeVisible()
    await expectContentToFit()

    for (const label of ["MCQ Activity", "Cosmetics", "Settings"]) {
      const button = sections.getByRole("button", { name: label, exact: true })
      await button.click()
      await expect(button).toHaveAttribute("aria-current", "page")
      await expectContentToFit()
    }
    await expect(page.getByRole("heading", { name: "Install & Study Offline" })).toBeVisible()
  })
}
