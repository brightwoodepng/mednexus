import { expect, test, type Page } from "@playwright/test"

const account = {
  uid: "admin-1",
  name: "Ada Admin",
  status: "approved",
  classLevel: "Level 400",
  role: "ADMIN",
  canAccessAdmin: true,
}

async function mockAuthenticatedSession(page: Page) {
  await page.route("**/api/auth/login", async route => {
    await route.fulfill({ json: { ...account, indexNumber: "SM/22/0001", sessionToken: "signed-test-token", requiresPasswordUpdate: false } })
  })
  await page.route("**/api/auth/session", async route => route.fulfill({ json: account }))
  await page.route("**/api/sync", async route => route.fulfill({ json: { name: account.name, progress: {} } }))
}

async function openAccountMenu(page: Page) {
  await page.getByRole("button", { name: "Open account menu" }).click()
}

async function dismissWelcomeIfShown(page: Page) {
  const startLearning = page.getByRole("button", { name: "Start Learning" })
  try {
    await startLearning.waitFor({ state: "visible", timeout: 2_000 })
    await startLearning.click()
  } catch {
    // Returning learners do not see the one-time welcome.
  }

  const closeTutorial = page.getByRole("button", { name: "Close and resume tutorial later" })
  try {
    await closeTutorial.waitFor({ state: "visible", timeout: 2_000 })
    await closeTutorial.click()
  } catch {
    // The guided tutorial has already been dismissed on returning devices.
  }
}

test("public visitors only see authentication actions", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("mednexus.remembered-index-number.v1", "SM/22/0001")
  })
  await page.goto("/")
  await expect(page.getByTestId("auth-dashboard-preview")).toBeVisible()
  await expect(page.getByTestId("auth-rankings-preview")).toBeVisible()
  await expect(page.getByTestId("auth-dashboard-image")).toBeVisible()
  await expect(page.getByTestId("auth-dashboard-image")).toHaveAttribute("src", /auth-dashboard-preview\.png/)
  await expect(page.getByTestId("auth-ranking-image")).toBeVisible()
  await expect(page.getByTestId("auth-ranking-image")).toHaveAttribute("src", /auth-ranking-preview\.png/)
  await expect(page.getByTestId("auth-laptop-mockup")).toBeVisible()
  await expect(page.getByTestId("auth-laptop-hinge")).toBeVisible()
  await expect(page.getByTestId("auth-laptop-keyboard")).toBeVisible()
  await expect(page.getByTestId("auth-laptop-trackpad")).toBeVisible()
  await expect(page.getByTestId("auth-phone-mockup")).toBeVisible()
  await expect(page.getByTestId("auth-phone-status-bar")).toContainText("9:41")
  await expect(page.getByTestId("auth-phone-dynamic-island")).toBeVisible()
  await expect(page.getByTestId("auth-phone-home-indicator")).toBeVisible()
  await expect(page.getByText("Learn. Compete. Grow.")).toBeVisible()
  await expect(page.getByText("Track your progress, challenge your peers, and reach the top.")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Your medical school workspace." })).toHaveCount(0)
  await expect(page.getByText("Learn, practise, and progress in one place.")).toHaveCount(0)
  await expect(page.getByText("Rankings preview")).toHaveCount(0)
  await expect(page.getByText("Medical learning workspace")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
  await expect(page.locator("#login-index")).toHaveValue("SM/22/0001")
  await expect(page.locator("#login-pw")).toHaveValue("")
  await expect(page.locator("#login-pw")).toBeFocused()
  await expect(page.getByRole("button", { name: "Log In" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Continue as guest" })).toHaveClass(/auth-btn-secondary/)
  await expect(page.getByRole("button", { name: "Create an account" })).toHaveClass(/auth-link/)
  const authControlStyles = await page.evaluate(() => {
    const login = document.querySelector<HTMLButtonElement>("button[type='submit']")
    const guest = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.includes("Continue as guest"))
    const otp = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.includes("Enter with OTP"))
    const register = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.includes("Create an account"))
    if (!login || !guest || !otp || !register) throw new Error("Authentication controls are missing")
    const loginStyles = getComputedStyle(login)
    const guestStyles = getComputedStyle(guest)
    return {
      loginHeight: login.getBoundingClientRect().height,
      guestHeight: guest.getBoundingClientRect().height,
      loginRadius: loginStyles.borderRadius,
      guestRadius: guestStyles.borderRadius,
      guestShadow: guestStyles.boxShadow,
      otpDecoration: getComputedStyle(otp.querySelector("span")!).textDecorationLine,
      registerDecoration: getComputedStyle(register).textDecorationLine,
    }
  })
  expect(authControlStyles.guestHeight).toBe(authControlStyles.loginHeight)
  expect(authControlStyles.guestRadius).toBe(authControlStyles.loginRadius)
  expect(authControlStyles.guestShadow).toBe("none")
  expect(authControlStyles.otpDecoration).toBe("none")
  expect(authControlStyles.registerDecoration).toBe("none")
  await expect(page.getByText("Choose how you'd like to continue")).toHaveCount(0)
  await expect(page.getByText("Open Admin Console")).toHaveCount(0)

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 720 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.getByTestId("auth-dashboard-preview")).toBeHidden()
    await expect(page.getByTestId("auth-rankings-preview")).toBeHidden()
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
  }
})

test("desktop showcase and theme remain clear of the authentication card", async ({ page }) => {
  await page.goto("/")

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.getByTestId("auth-laptop-mockup")).toBeVisible()
    await expect(page.getByTestId("auth-phone-mockup")).toBeVisible()

    const taglineBox = await page.getByText("Learn. Compete. Grow.").boundingBox()
    const laptopBox = await page.getByTestId("auth-laptop-mockup").boundingBox()
    const phoneBox = await page.getByTestId("auth-phone-mockup").boundingBox()

    const themeBox = await page.getByRole("button", { name: "Theme" }).boundingBox()
    const cardBox = await page.getByTestId("auth-card-shell").boundingBox()
    expect(themeBox).not.toBeNull()
    expect(cardBox).not.toBeNull()
    expect(taglineBox).not.toBeNull()
    expect(laptopBox).not.toBeNull()
    expect(phoneBox).not.toBeNull()
    expect(themeBox!.y + themeBox!.height).toBeLessThan(cardBox!.y)
    expect(laptopBox!.y + laptopBox!.height).toBeLessThanOrEqual(taglineBox!.y)
    expect(phoneBox!.y + phoneBox!.height).toBeLessThanOrEqual(taglineBox!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
  }
})

test("landing showcase uses static screenshots without animation", async ({ page }) => {
  await page.goto("/")
  await page.setViewportSize({ width: 1440, height: 900 })

  await expect(page.getByTestId("auth-dashboard-image")).toBeVisible()
  await expect(page.getByTestId("auth-ranking-image")).toBeVisible()

  const animatedElements = await page.locator(".auth-landing, .auth-landing *").evaluateAll(elements =>
    elements
      .filter(element => getComputedStyle(element).animationName !== "none")
      .map(element => ({
        animationName: getComputedStyle(element).animationName,
        className: element.getAttribute("class"),
        tagName: element.tagName,
      })),
  )
  expect(animatedElements).toEqual([])
})

test("guest and registration replace the login card and return cleanly", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Continue as guest" }).click()
  await expect(page.getByRole("heading", { name: "Guest Access" })).toBeVisible()
  await expect(page.locator("#login-index")).toHaveCount(0)
  await page.getByRole("button", { name: "Back" }).click()

  await page.getByRole("button", { name: "Create an account" }).click()
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()
  await expect(page.locator("#reg-name")).toBeVisible()
  await expect(page.locator("#login-index")).toHaveCount(0)
  await page.getByRole("button", { name: "Back" }).click()
  await expect(page.locator("#login-index")).toBeVisible()
})

test("platform settings hide unavailable secondary authentication actions", async ({ page }) => {
  await page.route("**/api/platform/config", route => route.fulfill({
    json: {
      registrationEnabled: false,
      guestAccessEnabled: false,
      maintenanceEnabled: false,
      maintenanceMessage: "",
    },
  }))
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Log In" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Continue as guest" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Create an account" })).toHaveCount(0)
})

test("a logged-in administrator retains the account menu after refresh", async ({ page }) => {
  await mockAuthenticatedSession(page)
  await page.goto("/")
  await page.locator("#login-index").fill("SM/22/0001")
  await page.locator("#login-pw").fill("password")
  await page.getByRole("button", { name: "Log In" }).click()
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("mednexus.remembered-index-number.v1"))).toBe("SM/22/0001")

  await dismissWelcomeIfShown(page)
  await openAccountMenu(page)
  await expect(page.getByRole("menuitem", { name: "Open Admin Console" })).toBeVisible()
  await page.reload()
  await dismissWelcomeIfShown(page)
  await openAccountMenu(page)
  await expect(page.getByRole("menuitem", { name: "Open Admin Console" })).toBeVisible()
})

test("a non-admin browser request is denied from /admin", async ({ page }) => {
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("button", { name: "Log In" })).toBeVisible()
})

test("an administrator can move to the console and return to the learner workspace", async ({ page }) => {
  test.setTimeout(60_000)
  await mockAuthenticatedSession(page)
  await page.route(/\/admin(?:\?.*)?$/, route => route.fulfill({
    contentType: "text/html",
    body: '<main><h1>MedNexus Console</h1><a href="/">Return to Learner Workspace</a></main>',
  }))
  await page.goto("/")
  await page.locator("#login-index").fill("SM/22/0001")
  await page.locator("#login-pw").fill("password")
  await page.getByRole("button", { name: "Log In" }).click()

  await dismissWelcomeIfShown(page)
  await openAccountMenu(page)
  await page.getByRole("menuitem", { name: "Open Admin Console" }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole("heading", { name: "MedNexus Console" })).toBeVisible()
  await page.getByRole("link", { name: "Return to Learner Workspace" }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible({ timeout: 20_000 })
})
