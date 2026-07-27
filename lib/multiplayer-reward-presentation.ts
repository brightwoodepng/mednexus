import { ECONOMY_CONFIG } from "@/lib/economy-config"

const numberFormatter = new Intl.NumberFormat("en-US")

export function formatNexusPoints(value: number): string {
  return `${numberFormatter.format(value)} NP`
}

function ordinal(place: number): string {
  const remainder = place % 100
  if (remainder >= 11 && remainder <= 13) return `${place}th`
  return `${place}${place % 10 === 1 ? "st" : place % 10 === 2 ? "nd" : place % 10 === 3 ? "rd" : "th"}`
}

/** Player-facing copy for the server-authoritative multiplayer reward policy. */
export function getMultiplayerRewardPresentation() {
  const rewards = ECONOMY_CONFIG.gameRewards.multiplayer
  const placeBonuses = rewards.placeBonuses
    .map((bonus, index) => `${ordinal(index + 1)} +${formatNexusPoints(bonus)}`)
    .join(" · ")

  return {
    participation: `Participation reward: ${formatNexusPoints(rewards.participation)}`,
    placeBonuses: `Place bonuses: ${placeBonuses}`,
    firstDailyWin: `First daily win: +${formatNexusPoints(rewards.firstDailyWin)}`,
    dailyCap: `Daily multiplayer cap: ${formatNexusPoints(rewards.dailyCap)}`,
  } as const
}

export function getMultiplayerRewardRules(): string[] {
  const rewards = getMultiplayerRewardPresentation()
  return [rewards.participation, rewards.placeBonuses, rewards.firstDailyWin, rewards.dailyCap]
}
