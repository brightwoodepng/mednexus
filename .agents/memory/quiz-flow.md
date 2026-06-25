---
name: Quiz Flow Architecture
description: How the Module→Discipline→Quantity→Quiz flow works across components
---

## Flow

1. `Dashboard` calls `onReadyForQuiz({ module, discipline })` 
2. `MedNexusApp.handleReadyForQuiz` computes the `availableQuestions` pool:
   - `module === "__weak__"` → `getWeakAreaQuestions(progress.history)`
   - otherwise → `getQuestionsForModuleAndDiscipline(module, discipline)`
3. Sets `pendingQuiz = { questions, moduleName, discipline }` → shows `QuantityModal`
4. `QuantityModal` receives pre-computed `questions` pool, user picks quantity, calls `onStart(buildCocktail(questions, qty))`
5. `MedNexusApp` sets `activeQuiz = { questions, moduleName, discipline, mode: globalMode, startedAt: Date.now() }`
6. `QuizSimulator` receives `questions: Question[]` and `moduleName: string` directly (no subject-based lookup)
7. On complete → if exam mode → `saveExamScore()` → `setScreen("results")`

## Key design decisions

- QuantityModal takes a pre-computed question pool (not module/discipline strings) so it works for weak areas and normal modules identically.
- QuizSimulator does NOT look up questions — it receives them directly from the caller.
- `useCallback(handleReadyForQuiz)` MUST be defined before any early returns in MedNexusApp (Rules of Hooks).
- `StudyModeProvider` wraps `MedNexusApp` in `page.tsx`; `useStudyMode()` is safe everywhere inside the app.

**Why:**
Centralizing question computation in mednexus-app before showing the QuantityModal lets the modal be a pure UI component agnostic of how questions are sourced (weak areas vs module+discipline).
