---
name: Hooks Before Early Returns
description: MedNexusApp had a Rules of Hooks bug from useCallback placed after early returns
---

## Rule

All hooks (`useState`, `useCallback`, `useEffect`, etc.) in `MedNexusApp` must appear **before** any early return statements (`if (!authReady) return ...`, `if (!user) return ...`).

## Why

`handleReadyForQuiz = useCallback(...)` was originally placed after `if (!authReady) return` and `if (!user) return`. This violated React's Rules of Hooks, causing a "Rendered more hooks than during the previous render" crash on HMR reload transitions.

**Fix:** move all `useCallback` definitions to the top of the component body, before the first early return.

## How to apply

When adding new hooks to `MedNexusApp`, always place them in the hook declaration block at the top of the function, before the `if (!authReady)` guard.
