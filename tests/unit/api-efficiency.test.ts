import { describe, expect, it } from "vitest"

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  boundedPagination,
  serializedBytes,
} from "../../lib/api-efficiency"

describe("API transfer safeguards", () => {
  it("defaults list requests to 20 rows", () => {
    expect(boundedPagination(new URLSearchParams())).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      offset: 0,
    })
  })

  it("caps page size at 50 and calculates a bounded offset", () => {
    expect(boundedPagination(new URLSearchParams("page=3&pageSize=500"))).toEqual({
      page: 3,
      pageSize: MAX_PAGE_SIZE,
      offset: 100,
    })
  })

  it("recovers from invalid and negative pagination values", () => {
    expect(boundedPagination(new URLSearchParams("page=-2&pageSize=nope"))).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      offset: 0,
    })
  })

  it("measures the actual UTF-8 serialized response size", () => {
    expect(serializedBytes({ value: "é" })).toBe(Buffer.byteLength('{"value":"é"}', "utf8"))
  })
})
