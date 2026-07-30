# Question-bank transfer policy

## Learner requests

Learner startup is limited to the authenticated `view=catalog` aggregate. The
catalog contains module, discipline, topic, count, total-count and update-version
metadata only. Module and study sessions use filtered runtime pages. Game mode
uses one bounded 25-record pool and does not reconstruct the bank.

## Full-bank allowlist

`loadFullQuestionBank` is intentionally named and restricted to the question
editor. The editor requires all records for administrative editing, while the
HTTP route still supplies them as ordered, bounded pages. Export, recovery and
future audit tools must use this explicit function or a streaming server export;
learner components must not call it.

## Page-size safety target

Runtime pages are capped at 25 records. The safety fixture assumes a
representative worst-case record of 200 KiB after JSON serialization (long stem
and explanation, embedded/base64 stem media and option media). Twenty-five such
records are approximately 5 MiB, leaving about 1 MiB of headroom beneath a
common 6 MiB serverless response ceiling. Actual UTF-8 response bytes are
recorded by server and client instrumentation so this assumption can be
monitored and the cap reduced if production records grow.
