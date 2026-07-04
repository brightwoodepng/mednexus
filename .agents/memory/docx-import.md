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
- As of July 2026 the entire `gemini-1.5-*` series returns 404 (deprecated/removed) and `gemini-2.0-*` is limit=0 on this key — the working cascade is `gemini-2.5-flash-lite` → `gemini-flash-lite-latest` → `gemini-2.5-flash` → `gemini-flash-latest`. Model availability drifts over time; if imports silently fall back to regex again, re-probe candidate model names directly against the Gemini API before assuming the prompt is at fault.
- Cascade must continue to the next model on ANY error status (429/404/400 AND transient 5xx/503 "high demand" — these do occur and are not rare), not just quota/not-found — bailing early on a transient error wastes the whole cascade and silently drops to the regex fallback.
- JSON parse errors → also try next model
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

## Per-question subject/discipline detection
- The Gemini system prompts (both parse-pdf and parse-docx) must explicitly instruct the model to infer each question's clinical discipline (Cardiology, Endocrinology, etc.) from the vignette content itself, and only fall back to the user-supplied moduleName when no clue exists.
- Without this explicit instruction, Gemini defaults to echoing the supplied moduleName for every question even when it successfully parses — so all questions land in one discipline bucket even though AI parsing "worked" (source: "ai"/"gemini"). A working AI path is not sufficient; verify per-question subjects actually differ when the source text spans multiple disciplines.

**Why:** The GEMINI_API_KEY is on the free tier which blocks gemini-2.0-flash. Without the cascade and fallback, imports silently fall back to plain-text regex parsing and all images are lost.

## Non-AI fallback parsers need their own subject detection
- The Gemini prompt instructions alone don't help when Gemini is skipped/exhausted — the server-side block-based HTML fallback (parse-docx), the regex fallback (parse-pdf), and the client-side regex fallbacks (word-import-modal.tsx, pdf-import-modal.tsx) all previously hardcoded `subject = moduleName` for every question, silently reintroducing the single-discipline-dump bug whenever the AI path wasn't used.
- Fixed via a shared heuristic in `lib/subject-detect.ts` (`detectSubject(text, fallback)`) — scores vignette text against per-discipline keyword lists and picks the best match, falling back to the supplied module/file name only if nothing matches. Wired into all four fallback code paths plus Gemini's own `q.subject` null-fallback.
- **How to apply:** any new import/parse path (new file format, new fallback tier) must call `detectSubject()` rather than defaulting bare to the module name, or this bug will resurface.
