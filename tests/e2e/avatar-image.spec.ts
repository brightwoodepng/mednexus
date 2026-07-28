import { expect, test } from "@playwright/test"

test("serves an optimized avatar as an image", async ({ request }) => {
  const response = await request.get("/_next/image", {
    params: {
      url: "/avatars/scrubs.png",
      w: "256",
      q: "82",
    },
    headers: { Accept: "image/avif,image/webp" },
  })

  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toMatch(/^image\/(avif|webp)$/)
  expect((await response.body()).byteLength).toBeGreaterThan(0)
})
