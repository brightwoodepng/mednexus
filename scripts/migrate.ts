/** Apply database schema migrations. Run during deployment, never in request handlers. */
import { ensureSchema } from "../lib/db"

ensureSchema()
  .then(() => { console.log("Database migrations applied.") })
  .catch((error) => { console.error("Database migration failed.", error); process.exitCode = 1 })
