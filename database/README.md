# Database

SQLite, one file, opened by the backend through `better-sqlite3` (DESIGN.md section 4.4). Tables follow DESIGN.md section 5.2.

| Folder | Contents |
|---|---|
| [`migrations/`](migrations/) | Plain SQL migrations, applied in name order when the backend starts (`backend/src/db/db.ts`) |
| `seed/` | Fictional fixtures: `config.json`, `users.json`, `customers.json`, `transporters.json`, `routes.json`, `history.json`, `scenario-main.json` (DESIGN.md 10.1). Read by `backend/src/sim/fixtures.ts`; until they are added the backend uses `backend/test/fixtures-stub` |

The database file itself is created at run time and is git-ignored. `POST /api/v1/demo/reset` or `npm run seed` (in `backend/`) restores it from the seed.
