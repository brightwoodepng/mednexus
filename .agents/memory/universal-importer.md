---
name: Universal Importer/Exporter Architecture
description: How the Import/Export Data modal is wired — flows, state handoff, and mediaBase64 propagation.
---

# Universal Importer/Exporter

## What it is
A modal (components/universal-importer.tsx) opened from the Admin sidebar "Import / Export" button. Admin-only.

## Entry point
- `components/sidebar.tsx` → `onOpenImporter` prop → button in both full and collapsed admin sections
- `components/mednexus-app.tsx` manages `importerOpen` + `pendingEditorImport` state
- Renders `<UniversalImporter>` when `importerOpen && isAdmin`

## Import flows (all route to Preview Staging before editor)
1. **JSON file** — parsed client-side, validated, sent straight to preview
2. **DOCX file** — `/api/parse-docx` (text extraction) → client-side chunking (~2000 words) → relay race loop calling `/api/extract-single-chunk` per chunk → preview
3. **PDF file** — `lib/pdf-extract.ts` (pdfjs client-side) → `/api/parse-pdf` → preview
4. **Raw text paste** — single call to `/api/extract-single-chunk` → regex fallback → preview

## Preview Staging → Editor handoff
1. User clicks "Confirm & Import to Editor"
2. `onImport(pendingImport)` is called → `mednexus-app.tsx` sets `pendingEditorImport` and navigates to `question-editor`
3. `QuestionEditor` has a `pendingImport` prop + `onPendingImportConsumed` prop
4. useEffect in QuestionEditor merges pendingImport into draftQuestions, sets filterMode to "draft", then calls `onPendingImportConsumed` (which clears the state in parent)

## Export
- "Export JSON" button calls `useQuestions().questions` → JSON.stringify → browser download as `mednexus-questions-[DATE].json`
- Exported JSON includes `mediaBase64` so round-trip imports restore images

## mediaBase64 field
- Added to `Question` type in `lib/types.ts` as optional `mediaBase64?: string | null`
- Propagated through: `extract-single-chunk/route.ts` (ChunkQuestion interface + sanitize step) and `parse-pdf/route.ts` (ParsedQuestion, GeminiParsedQuestion, normaliseQuestion)
- Preview cards render the image inline if `mediaBase64` is present
- Currently returns null for text-based imports (no embedded images in text); reserved for future multimodal extraction

**Why:** Anti-hallucination design — schema field exists so Gemini can populate it when actual image data is available, but never invented from text content.
