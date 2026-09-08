# Theory Group Study

Theory rooms share the existing Group Study PIN, membership, presence, host transfer,
flags and immutable question snapshots. MCQ remains the default for existing rooms.

## Workflow

- Theory Vault sidebar → Group Study → Theory.
- Select collection, module, discipline, published set, question count, navigation mode and optional discussion timer.
- Join by PIN or invite link; use the existing ready lobby.
- Read structured prompts and media together. No submission, scoring or reward writes occur.
- Host can reveal a model answer or move on directly, including prompt-only questions.
- Left/right keys navigate; typing is excluded. Finishing requires the explicit button and confirmation.
- Host-paced, private browse-ahead and anyone-advances are supported. Only the host reveals answers.
- Private notes, bookmarks and revision actions use existing per-user Theory Vault storage.
- Completion shows participants, opened questions, revealed answers and personal flags rather than rankings.

## Database deployment

Run `npm run db:migrate-theory-group-study` with the existing migration PostgreSQL connection configured.
The script reads standard environment configuration, requires an existing Group Study schema,
locks the migration, applies its changes transactionally and verifies both new columns.
No database URL should be committed or sent in chat.

Changes: `study_type` on rooms (default `mcq`), `revealed_at` on room questions,
and a study-type-aware timer constraint. The full release migration also includes the same idempotent SQL.
Theory creation checks for its new columns without executing DDL. Before this release migration runs,
Theory creation returns `THEORY_SCHEMA_REQUIRED`; existing MCQ rooms remain available.
The dedicated script does not mark unrelated full-release migrations as complete.

## Security and compatibility

Room mutations remain transactional with a row lock and verified membership.
Theory movement carries the expected current index; repeated stale Next calls fail.
Theory submits and MCQ-style answer closing are rejected server-side. Timers do not reveal answers.
Reveal history is per-question, including final review: skipping never reveals a model answer.
Only published questions in published, non-deleted sets/collections are selected.
Existing MCQ answer gating, grading, NP/XP, timer options and room behavior are retained.

## Verification

Run `npm test` and `npm run build`. Route tests cover direct progression, timer expiry,
host authorization, hidden model answers, completion without rewards, stale requests and MCQ gating.
These tests use a mocked database adapter and do not certify a live PostgreSQL migration.
After deployment, verify create/join/reveal/next/reconnect using two separate authenticated sessions.
