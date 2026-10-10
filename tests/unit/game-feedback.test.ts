import { afterEach, describe, expect, it, vi } from "vitest"
import { GAME_PRESENTATION, revealedGameOutcome } from "../../lib/game-presentation"

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe("game feedback", () => {
  it("covers every solo and multiplayer mode with distinct presentation", () => {
    expect(Object.keys(GAME_PRESENTATION)).toEqual(["rapid", "sudden", "timeatk", "streak", "double", "clash", "cohort", "wager", "djmulti"])
    expect(new Set(Object.values(GAME_PRESENTATION).map(mode => mode.accent)).size).toBe(9)
    for (const mode of Object.values(GAME_PRESENTATION)) {
      expect(mode.notes).toHaveLength(3)
      expect(mode.correct).not.toBe(mode.wrong)
    }
  })
  it("waits for a revealed answer key, including unanswered rounds", () => {
    expect(revealedGameOutcome(false, "A", "A")).toBeNull()
    expect(revealedGameOutcome(true, "A", "")).toBeNull()
    expect(revealedGameOutcome(true, "A", "A")).toBe("correct")
    expect(revealedGameOutcome(true, "B", "A")).toBe("wrong")
    expect(revealedGameOutcome(true, null, "A")).toBe("wrong")
  })
  it("honors persisted sound and haptic preferences", async () => {
    vi.stubGlobal("localStorage", { getItem: () => '{"sound":false,"haptics":false}' })
    const feedback = await import("../../lib/game-feedback")
    expect(feedback.readGameFeedbackPreferences()).toEqual({ sound: false, haptics: false })
    vi.stubGlobal("localStorage", { getItem: () => "invalid" })
    expect(feedback.readGameFeedbackPreferences()).toEqual({ sound: true, haptics: true })
  })
  it("plays short mode-specific notes and respects mute, motion and background settings", async () => {
    const vibrate = vi.fn()
    const notes: Array<{ frequency: { value: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = []
    class Audio {
      state = "running"
      currentTime = 2
      destination = {}
      resume = vi.fn().mockResolvedValue(undefined)
      createOscillator() {
        const note = { type: "", frequency: { value: 0 }, start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), onended: null }
        notes.push(note); return note
      }
      createGain() { return { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() } }
    }
    vi.stubGlobal("window", { AudioContext: Audio })
    vi.stubGlobal("navigator", { vibrate })
    vi.stubGlobal("document", { visibilityState: "visible" })
    const feedback = await import("../../lib/game-feedback")
    feedback.unlockGameAudio()
    feedback.playGameFeedback("rapid", true, { sound: true, haptics: true })
    expect(notes.map(n => n.frequency.value)).toEqual(GAME_PRESENTATION.rapid.notes)
    expect(vibrate).toHaveBeenCalledWith([25, 35, 45])
    expect(notes.every(n => n.stop.mock.calls[0][0] - n.start.mock.calls[0][0] < .2)).toBe(true)
    notes.length = 0; vibrate.mockClear()
    feedback.playGameFeedback("rapid", false, { sound: false, haptics: false })
    expect(notes).toHaveLength(0); expect(vibrate).not.toHaveBeenCalled()
    feedback.playGameFeedback("rapid", false, { sound: false, haptics: true }, true)
    expect(vibrate).not.toHaveBeenCalled()
    vi.stubGlobal("document", { visibilityState: "hidden" })
    feedback.playGameFeedback("rapid", true, { sound: true, haptics: true })
    expect(notes).toHaveLength(0); expect(vibrate).not.toHaveBeenCalled()
  })
  it("does not interrupt gameplay when effects APIs are missing or blocked", async () => {
    vi.stubGlobal("window", {})
    vi.stubGlobal("navigator", { vibrate: () => { throw new Error("Unavailable") } })
    const feedback = await import("../../lib/game-feedback")
    expect(() => feedback.unlockGameAudio()).not.toThrow()
    expect(() => feedback.playGameFeedback("streak", true, { sound: true, haptics: true })).not.toThrow()
  })
})
