export const LAST_GROUP_STUDY_PIN_KEY = "mednexus:last-group-study-pin"

export function rememberGroupStudyPin(pin: string) {
  window.localStorage.setItem(LAST_GROUP_STUDY_PIN_KEY, pin)
}

export function forgetGroupStudyPin() {
  window.localStorage.removeItem(LAST_GROUP_STUDY_PIN_KEY)
}
