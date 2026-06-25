---
name: Admin Question Editor Architecture
description: Key design decisions for the hierarchical question editor and PDF import modal
---

## Hierarchy model
- Module = `q.module?.trim() || q.subject` (computed via `getModuleKey(q)`)
- Discipline = `q.subject`
- Questions are grouped: Module → Discipline → Questions
- All grouping computed in `buildHierarchy()` in question-editor.tsx

## Draft staging
- `draftQuestions: Question[]` lives in local editor state (not DB)
- Imported PDF questions arrive as drafts; live questions via `addQuestion` go straight to DB
- "Make Live" calls `addQuestion` per draft, then removes from draftQuestions
- Filter dropdown (All/Live/Draft) controls which items appear in the tree

**Why:** Admins need to review PDF-imported questions before they go live to all users.

## PDF import (pdf-import-modal.tsx)
- Client-side text extraction via `pdfjs-dist` (worker at `/public/pdf.worker.min.mjs`)
- Regex parser patterns defined in `PARSER_PATTERNS` array — each entry has `{re, tip}`
- Tips in the UI are generated directly from `PARSER_PATTERNS[i].tip`, not hardcoded separately
- Accepts .pdf and .txt; paste fallback via textarea
- Returns questions via `onImport(questions)` — caller stages them as drafts

## Rename module
- Renames the `q.module` field (not `q.subject`) for all questions where `getModuleKey(q) === oldName`
- Questions without a `module` field (using subject as key fallback) also get `module` set explicitly

## Bulk selection
- `selectedIds: Set<string>` tracks selected question IDs
- Module/discipline checkboxes show indeterminate state when partially selected
- Bulk actions: Delete Selected, Make Live (drafts only), with confirmation dialogs
