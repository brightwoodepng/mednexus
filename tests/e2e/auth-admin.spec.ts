import { expect, test, type Page } from "@playwright/test"

const account = {
  uid: "admin-1",
  name: "Ada Admin",
  status: "approved",
  classLevel: "Level 400",
  role: "ADMIN",
}

async function mockAuthenticatedSession(page: Page) {
  await page.route("**/api/auth/login", async route => {
    await route.fulfill({ json: { ...account, indexNumber: "SM/22/0001", sessionToken: "signed-test-token", requiresPasswordUpdate: false } })
  })
  await page.route("**/api/auth/session", async route => route.fulfill({ json: account }))
  await page.route("**/api/sync", async route => route.fulfill({ json: { name: account.name, progress: {} } }))
}

test("public visitors only see authentication actions", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Sign in / Create account" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Continue as guest" })).toBeVisible()
  await expect(page.getByText("Open Admin Console")).toHaveCount(0)
})

test("a logged-in administrator retains the account menu after refresh", async ({ page }) => {
  await mockAuthenticatedSession(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Sign in / Create account" }).click()
  await page.locator("#login-index").fill("SM/22/0001")
  await page.locator("#login-pw").fill("password")
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page.getByText(account.name)).toBeVisible()
  await expect(page.getByRole("link", { name: "Open Admin Console" })).toBeVisible()
  await page.reload()
  await expect(page.getByText(account.name)).toBeVisible()
  await expect(page.getByRole("link", { name: "Open Admin Console" })).toBeVisible()
})

test("a non-admin browser request is denied from /admin", async ({ page }) => {
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("button", { name: "Sign in / Create account" })).toBeVisible()
})

test("an administrator can move to the console and return to the learner workspace", async ({ page }) => {
  await mockAuthenticatedSession(page)
  await page.route(/\/admin(?:\?.*)?$/, route => route.fulfill({
    contentType: "text/html",
    body: '<main><h1>MedNexus Console</h1><a href="/">Return to Learner Workspace</a></main>',
  }))
  await page.goto("/")
  await page.getByRole("button", { name: "Sign in / Create account" }).click()
  await page.locator("#login-index").fill("SM/22/0001")
  await page.locator("#login-pw").fill("password")
  await page.getByRole("button", { name: "Sign in" }).click()

  await page.getByRole("link", { name: "Open Admin Console" }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole("heading", { name: "MedNexus Console" })).toBeVisible()
  await page.getByRole("link", { name: "Return to Learner Workspace" }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText(account.name)).toBeVisible()
})
