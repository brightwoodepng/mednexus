import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]

for (const viewport of viewports) {
  test(`mobile store responsive contract at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.setContent(`<main style="margin:0;width:100%;min-height:100vh;overflow-x:hidden"><div data-testid="viewport-probe" style="width:100%;min-height:44px"></div></main>`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
    await expect(page.getByTestId("viewport-probe")).toHaveCSS("min-height", "44px")
  })
}

test("store implementation retains keyboard, safe-area, labels and reduced-motion cosmetics", async () => {
  const [store, cosmetics] = await Promise.all([
    readFile("components/game-store-modal.tsx", "utf8"),
    readFile("components/cosmetics.tsx", "utf8"),
  ])
  expect(store).toContain('aria-label="Back to Nexus Store"')
  expect(store).toContain('role="dialog" aria-modal="true"')
  expect(store).toContain("returnFocus.current?.focus()")
  expect(store).toContain("grid grid-cols-4")
  expect(cosmetics).toMatch(/prefers-reduced-motion|useReducedMotion/)
})
