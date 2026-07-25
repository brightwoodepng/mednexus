// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { ThemeProvider, useTheme } from "@/contexts/theme-context"

function Harness() {
  const { activeTheme, setActiveTheme, isGlassEnabled, setIsGlassEnabled } = useTheme()
  return <>
    <output data-testid="theme">{activeTheme}</output>
    <output data-testid="glass">{String(isGlassEnabled)}</output>
    <button onClick={() => setActiveTheme("sandstone")}>Sandstone</button>
    <button onClick={() => setIsGlassEnabled(!isGlassEnabled)}>Glass</button>
  </>
}

const mount = () => render(<ThemeProvider><Harness /></ThemeProvider>)

describe("ThemeProvider glass preference", () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-glass") })
  afterEach(cleanup)

  it("toggles glass independently, persists it, and reflects it on the root", async () => {
    const first = mount()
    fireEvent.click(screen.getByText("Sandstone"))
    fireEvent.click(screen.getByText("Glass"))
    expect(screen.getByTestId("theme").textContent).toBe("sandstone")
    await waitFor(() => expect(document.documentElement.dataset.glass).toBe("true"))
    expect(localStorage.getItem("mednexus-glass")).toBe("true")

    first.unmount()
    mount()
    await waitFor(() => expect(screen.getByTestId("glass").textContent).toBe("true"))
    expect(screen.getByTestId("theme").textContent).toBe("sandstone")
    fireEvent.click(screen.getByText("Glass"))
    await waitFor(() => expect(document.documentElement.hasAttribute("data-glass")).toBe(false))
  })

  it.each([
    ["liquid-glass-light", "clinical-light"],
    ["liquid-glass-dark", "classic-dark"],
  ])("migrates legacy %s to %s with glass enabled", async (legacy, base) => {
    localStorage.setItem("mednexus-theme", legacy)
    mount()
    await waitFor(() => expect(screen.getByTestId("theme").textContent).toBe(base))
    expect(screen.getByTestId("glass").textContent).toBe("true")
    expect(localStorage.getItem("mednexus-theme")).toBe(base)
    expect(localStorage.getItem("mednexus-glass")).toBe("true")
    expect(document.documentElement.dataset.glass).toBe("true")
  })
})
