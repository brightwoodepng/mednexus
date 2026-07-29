# Game-room traffic check

Run the reproducible route-level traffic check with:

```bash
pnpm check:game-room-traffic
```

The check calls the real `GET /api/game-rooms/[pin]` handler with a deterministic,
in-memory Postgres adapter and authenticated identities. It simulates 2, 5, and
10 participants through a ten-question match with lobby, question,
answered-waiting, reveal, and completion samples. The adapter records every SQL
statement, while the harness records response bytes and handler latency. Each run
prints one machine-readable `GAME_ROOM_TRAFFIC` JSON record per room size.

## Match model and budgets

The fixed model uses a 1.5-second client poll cadence, a 15-second lobby, ten
questions with 15 seconds before answering, 3 seconds answered-waiting, 3 seconds
of reveal, and a final completion poll. Every participant first performs the
pool-bearing bootstrap request. Subsequent version changes return only the
current-question delta; steady polls return only `{ unchanged, version }`.

The budgets below are ceilings, not expected production targets. The check fails
if any ceiling is exceeded:

| Metric | Per-match ceiling |
| --- | ---: |
| Requests | 152 per participant |
| Database statements | 183 per participant |
| Row-locking transactions caused by GET polling | 0 per match |
| Response transfer | 180,000 bytes per participant |
| Route-handler p95 latency (in-memory adapter) | 25 ms |

Database and transfer ceilings scale linearly with authenticated participants;
the 10-participant scenario is therefore capped at 1,830 statements and
1,800,000 response bytes. The latency threshold intentionally measures handler
regressions rather than network or production Postgres latency.

## Regression guarantees

In addition to the numeric ceilings, the check fails unless:

- all five requested match phases were sampled;
- only bootstrap responses contain the full `questionPool`;
- unchanged responses contain neither `questionPool` nor `currentQuestion`;
- no poll SQL statement contains `FOR UPDATE`; and
- the client retains its in-flight guard and schedules the next timeout only
  after the prior poll settles, with no interval-based poll loop.

This is a deterministic CI regression check, not a production load test. Use a
staging load test separately when measuring network, deployment, or real
Postgres latency.
