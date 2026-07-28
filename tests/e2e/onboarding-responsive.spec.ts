import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"

const sizes = [
  { name: "320px phone", width: 320, height: 568 },
  { name: "390px phone", width: 390, height: 844 },
  { name: "landscape phone", width: 844, height: 390 },
  { name: "desktop", width: 1440, height: 900 },
]
for (const size of sizes) test(`${size.name} keeps tutorial actions reachable`, async ({ page }) => {
  await page.setViewportSize(size)
  await page.setContent(`<main style="height:100dvh;overflow:hidden;padding:env(safe-area-inset-top) 8px env(safe-area-inset-bottom)"><section role="dialog" style="box-sizing:border-box;max-height:72dvh;overflow:auto"><button style="min-height:44px">Previous</button><button style="min-height:44px">Next</button><button style="min-height:44px">Skip tutorial</button><button style="min-height:44px">Close and resume later</button></section></main>`)
  await expect(page.getByRole("button", { name: "Next" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test("responsive onboarding implementation includes accessibility and restoration contracts", async () => {
  const [overlay, controller, sidebar, bottom, tutorials] = await Promise.all([
    readFile("components/onboarding/TutorialOverlay.tsx", "utf8"),
    readFile("components/onboarding/TutorialNavigationController.tsx", "utf8"),
    readFile("components/sidebar.tsx", "utf8"),
    readFile("components/bottom-nav.tsx", "utf8"),
    readFile("components/onboarding/tutorials.ts", "utf8"),
  ])
  expect(overlay).toContain("visualViewport")
  expect(overlay).toContain("ResizeObserver")
  expect(overlay).toContain('event.key === "Escape"')
  expect(overlay).toContain('event.key === "Tab"')
  expect(overlay).toContain('aria-live="polite"')
  expect(controller).toContain("restoreUi")
  expect(controller).toContain("initialTheme")
  expect(sidebar).toContain('"drawer-navigation"')
  expect(sidebar).toContain('"desktop-navigation"')
  expect(bottom).toContain('mobile-bottom-nav-${tab.id}')
  expect(tutorials).toContain('interaction: { type: "try-it"')
})
