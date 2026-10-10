export type ArenaMode = "rapid" | "sudden" | "timeatk" | "streak" | "double" | "clash" | "cohort" | "wager" | "djmulti"
export type GameOutcome = "correct" | "wrong" | null

export const GAME_PRESENTATION = {
  rapid: { title: "Rapid Fire", icon: "⚡", accent: "#8b5cf6", glow: "#d946ef", mission: "Fast thinking. Big combos.", correct: "Lightning strike!", wrong: "Shake it off — stay sharp.", notes: [523, 659, 784] },
  sudden: { title: "Sudden Death", icon: "💀", accent: "#e11d48", glow: "#f97316", mission: "One life. Make every move count.", correct: "Still standing!", wrong: "Your run ends here.", notes: [392, 523, 659] },
  timeatk: { title: "Time Attack", icon: "⏱️", accent: "#0891b2", glow: "#3b82f6", mission: "Beat the clock. Win back time.", correct: "Time recovered!", wrong: "Time lost — keep moving.", notes: [659, 784, 988] },
  streak: { title: "Streak Master", icon: "🔥", accent: "#ea580c", glow: "#f59e0b", mission: "Build your fire. Keep the combo alive.", correct: "Keep that fire going!", wrong: "Fresh start. Build it again.", notes: [440, 554, 659] },
  double: { title: "Double Jeopardy", icon: "🎲", accent: "#6366f1", glow: "#a855f7", mission: "Back your knowledge. Grow your bank.", correct: "Confidence pays off!", wrong: "Wager lost. Play your next move.", notes: [523, 784, 1047] },
  clash: { title: "Multiplayer Clash", icon: "⚔️", accent: "#7c3aed", glow: "#ec4899", mission: "Quick reactions. Climb the leaderboard.", correct: "Clean hit!", wrong: "Next round, new chance.", notes: [587, 740, 880] },
  cohort: { title: "Cohort Review", icon: "🎯", accent: "#0284c7", glow: "#14b8a6", mission: "Pick your tile. Make your mark.", correct: "Nailed it!", wrong: "Get ready for the next round.", notes: [523, 659, 880] },
  wager: { title: "Wager Wars", icon: "🪙", accent: "#b45309", glow: "#f59e0b", mission: "Choose your stake. Defend your balance.", correct: "Winning wager!", wrong: "Wager lost. Rebuild your balance.", notes: [440, 659, 880] },
  djmulti: { title: "Double Jeopardy Multiplayer", icon: "🏦", accent: "#4f46e5", glow: "#8b5cf6", mission: "Raise the stakes. Outplay the room.", correct: "Bank boosted!", wrong: "Wager lost. Stay in the game.", notes: [392, 587, 784] },
} satisfies Record<ArenaMode, { title: string; icon: string; accent: string; glow: string; mission: string; correct: string; wrong: string; notes: number[] }>

/** Only show multiplayer correctness after the server publishes its answer key. */
export function revealedGameOutcome(revealed: boolean, answer: string | null, correctAnswer: string | null | undefined): GameOutcome {
  if (!revealed || !correctAnswer) return null
  return answer === correctAnswer ? "correct" : "wrong"
}
