import { GAME_PRESENTATION, type ArenaMode } from "@/lib/game-presentation"

export interface GameFeedbackPreferences { sound: boolean; haptics: boolean }
export const GAME_FEEDBACK_KEY = "mednexus:game-feedback:v1"

export function readGameFeedbackPreferences(): GameFeedbackPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(GAME_FEEDBACK_KEY) ?? "{}")
    return { sound: value.sound !== false, haptics: value.haptics !== false }
  } catch { return { sound: true, haptics: true } }
}

let audio: AudioContext | null = null
export function unlockGameAudio() {
  if (typeof window === "undefined") return
  try {
    const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Constructor) return
    if (!audio || audio.state === "closed") audio = new Constructor()
    if (audio.state === "suspended") void audio.resume().catch(() => {})
  } catch { /* Optional enhancement: gameplay works without Web Audio. */ }
}

export function playGameFeedback(mode: ArenaMode, correct: boolean, preferences: GameFeedbackPreferences, reducedMotion = false) {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return
  if (preferences.haptics && !reducedMotion && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try { navigator.vibrate(correct ? [25, 35, 45] : [55, 35, 55]) } catch {}
  }
  if (!preferences.sound || !audio || audio.state !== "running") return
  try {
    const notes = correct ? GAME_PRESENTATION[mode].notes : [196, 147]
    notes.forEach((frequency, index) => {
      const oscillator = audio!.createOscillator()
      const gain = audio!.createGain()
      const start = audio!.currentTime + index * .075
      oscillator.type = correct ? "sine" : "triangle"
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(correct ? .06 : .025, start + .012)
      gain.gain.exponentialRampToValueAtTime(.001, start + .16)
      oscillator.connect(gain); gain.connect(audio!.destination)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
      oscillator.start(start); oscillator.stop(start + .17)
    })
  } catch { /* Unsupported or suspended sound never interrupts a turn. */ }
}
