# Group Study MCQ V1

Group Study is a registered-account-only collaborative MCQ mode. It reuses the MedNexus question bank, signed account sessions, polling transport, learner progress records, cosmetics, NP ledger, anti-farming policy, weekly goals, and theme system.

## Architecture

- `mednexus_group_study_rooms` owns the room state, host, phase, timer timestamps, expiry, and optimistic version.
- `mednexus_group_study_room_questions` stores the fixed ordered question snapshots selected when the room is created.
- `mednexus_group_study_memberships` stores durable membership, late-join eligibility, connectivity, scores, streaks, and session NP.
- `mednexus_group_study_answers` enforces one answer per registered user and room question.
- `mednexus_group_study_reward_events` and the existing NP ledger provide independent idempotency boundaries.
- `POST /api/group-study` creates rooms. `GET /api/group-study` returns authoritative module/difficulty counts.
- `GET` and `POST /api/group-study/[pin]` implement join/rejoin, polling, ready, start, submit, close, next, leave, end, host transfer, bookmarks, revision, leaderboard, and final results.

Room and question mutations lock the room row. That lock serializes simultaneous joins, submissions, timer closure, and host controls. Correctness, scores, progress, and NP are calculated only from the stored question snapshot. Score/progress/NP processing is deferred until answering closes, so leaderboard changes or wallet changes cannot reveal correctness during the open phase.

## Late joining and reconnecting

- A member joining while the question is open is eligible for that question and receives only the remaining server timer.
- A member joining after closure starts eligibility on the next question and can still view the current reveal.
- Earlier questions never update their score, accuracy, streak, NP, missed history, or personal progress.
- Membership and answers are account-backed and durable. Refreshing or reopening the invitation restores the same membership.

## Ranking and economy

Ranking compares correct answers, attempted questions, and current correct streak—in that order. Submission speed is not stored or used for ranking. Equal values produce a tied rank.

Correct answers use the existing repeat schedule, discipline-fatigue limit, multiplayer daily limit, and global repeatable-NP ceiling. Eligible completion uses the existing multiplayer participation reward and minimum-answer/player rules. Answer activity also updates the existing daily activity and weekly-goal systems. Ledger source IDs are deterministic per user, room, question, and reward category.

## Manual test checklist

1. Sign in as two approved registered users in separate browser profiles.
2. Create a room for each difficulty and timer setting; verify the PIN and copied invitation link.
3. Join concurrently up to ten accounts and confirm an eleventh account receives `ROOM_FULL`.
4. Mark members ready; verify the host can confirm starting with unready members.
5. Submit different answers and verify only submission status—not choices, correctness, score, or NP—changes before reveal.
6. Join another account during an open timed question and verify the timer is not restarted.
7. Join during reveal and verify eligibility begins on the next question.
8. Refresh during lobby, open, waiting, reveal, and completed phases; verify state restoration and duplicate-answer rejection.
9. Disconnect the host, wait through the grace period, and verify one online member becomes host without state loss.
10. Verify tied rankings, final review, missed-question revision, personal history, wallet ledger entries, and daily/weekly economy limits.
11. Repeat at phone and desktop widths in light and dark themes.

## Operational notes

- V1 uses the existing polling convention and does not introduce WebSockets.
- A configured PostgreSQL database is required for Group Study; local browser-only progress cannot provide shared rooms.
- Difficulty filtering honors explicit MCQ difficulty fields/tags. Questions without difficulty metadata remain eligible as a compatibility fallback so legacy modules can still use all four selections.
