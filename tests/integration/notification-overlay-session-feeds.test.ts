import { describe, expect, it, vi } from "vitest"

import { loadNotificationFeedData, type StoredCredential } from "@/components/notification-overlay"

function successfulFeed() {
  return Promise.resolve(new Response(JSON.stringify({ notifications: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }))
}

describe("notification overlay session feeds", () => {
  it("loads only eligible broadcasts for a guest", async () => {
    const fetcher = vi.fn(successfulFeed)
    const credential: StoredCredential = { kind: "guest", token: "guest-token" }

    const result = await loadNotificationFeedData(credential, fetcher)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith("/api/notifications", {
      cache: "no-store",
      headers: { "x-guest-token": "guest-token" },
    })
    expect(result.personalData).toEqual({ notifications: [] })
  })

  it("loads broadcasts and personal notifications for a registered user", async () => {
    const fetcher = vi.fn(successfulFeed)
    const credential: StoredCredential = { kind: "registered", token: "session-token" }

    await loadNotificationFeedData(credential, fetcher)

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/notifications", {
      cache: "no-store",
      headers: { "x-session-token": "session-token" },
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/user-notifications", {
      cache: "no-store",
      headers: { "x-session-token": "session-token" },
    })
  })
})
