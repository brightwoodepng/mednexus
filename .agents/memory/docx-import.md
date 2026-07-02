---
name: Docx Import Pipeline
description: Architecture decisions and gotchas for the Word document question import system
---

## Image placeholder system
- mammoth embeds `__IMG_1__`, `__IMG_2__` etc. as `src` values instead of raw base64
- Images stored in a server-side `ImageMap` keyed by token → full `data:<mime>;base64,<b64>` URI
- Gemini only sees the small tokens (not MB of base64), keeping prompt token count low
- **Two restore functions** — do not mix them:
  - `restoreImageSrcs()` — for Gemini output: replaces token inside existing `src="..."` attribute
  - `restoreImageTokens()` — for fallback plain-text output: wraps bare tokens in full `<img>` element

## Gemini API key is free-tier
- `gemini-2.0-flash` has `limit: 0` on the free tier (completely unavailable)
- Cascade order: `gemini-2.0-flash-lite` → `gemini-1.5-flash-8b` → `gemini-1.5-flash` → `gemini-1.5-flash-latest`
- 429/404/400 → try next model; JSON parse errors → also try next model; other errors → bail
- If ALL models fail, the server-side block-based HTML fallback runs

## Block-based HTML fallback parser
- Splits mammoth HTML into typed blocks: TABLE (full `<table>` HTML), IMAGE (token), TEXT (line)
- `CTX_TRIGGER` regex detects "For questions 1–5", "Read the following passage", tables, images
- Creates `FallbackContext` objects for shared material; sets `currentContextId` on grouped questions
- Resets `currentContextId = null` when short/irrelevant pre-question text is discarded
- Detects question types: ASSERTION_REASON via `AR_OPT` regex on option text; MATCHING via stem content
- Returns `source: "gemini"` with structured contexts+questions so the client path is identical

## JS regex gotcha
- JS does NOT support `/x` (free-spacing/extended) mode
- Multi-pattern regexes must use `new RegExp([...].join("|"), "i")` not multiline literals with `//ix`
- `[to]` in a character class matches individual chars `t` and `o`, NOT the word "to" — use `(?:to|[-–—])`

## Context denormalization in word-import-modal.tsx
- Server returns `{ contexts: ServerContext[], questions: ServerQuestion[] }`
- Client builds `Map<contextId, content>` from the contexts array
- `makeQuestionFromServer()` accepts this map and sets `contextContent` on each question
- Without this step, `contextId` exists but `contextContent` is null → context panel shows blank

## Rich-text rendering
- `RichText` component in `components/rich-text.tsx` — detects HTML via tag regex, sanitizes via DOM allowlist
- Sanitizer allows: img (src, alt, width, height, loading), table/th/td (colspan/rowspan), standard formatting
- CSS in `app/globals.css` under `.rich-text` handles img max-width, table borders, zebra rows

**Why:** The GEMINI_API_KEY is on the free tier which blocks gemini-2.0-flash. Without the cascade and fallback, imports silently fall back to plain-text regex parsing and all images are lost.
