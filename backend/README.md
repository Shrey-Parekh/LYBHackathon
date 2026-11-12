# control-tower-api

Backend for the Order-to-Delivery Control Tower, Problem Statement 3 of the LYB Mumbai Hackathon 2026 (Round 2).

All data in this project is fictional. "Plant X" is the fictional company from the hackathon brief.

## Documents

| Document | Purpose |
|---|---|
| [DESIGN.md](DESIGN.md) | Engineering design: requirements mapping, architecture, domain model, API and event contracts, ETA and risk calculation, security, verification and demo script |
| [PHASES.md](PHASES.md) | Execution plan for three owners: phases, exit criteria, critical path and cut list |
| [AI_USAGE.md](AI_USAGE.md) | Declaration of generative AI use, required by the hackathon rules |

These are the canonical copies. The web repository, [control-tower-web](https://github.com/LYBHackathon/control-tower-web), links here.

## Run locally

Requires Node 24 or later (developed on Node 26 LTS).

```bash
npm install
cp .env.example .env   # then set JWT_SECRET to a long random string
npm run dev            # http://localhost:4000, migrates and seeds on start
npm test               # Vitest: T1-T13 and the contract sample test
npm run typecheck
```

API base path: `/api/v1`. Contract: `GET /openapi.json` (generated from the Zod schemas in `src/http/schemas.ts`).

Fixtures: the API loads `fixtures/` when `fixtures/scenario-main.json` exists, and otherwise the stand-ins in `test/fixtures-stub/` (used by the tests). Seeded demo passwords live only in the fixture files.

## Code map

| Folder | What it does | DESIGN.md |
|---|---|---|
| `src/eta` | `computeEta(state, now)`: pure rules engine for ETA, risk, confidence and reasons | 6.3-6.5 |
| `src/options` | `evaluateOptions`: pure option evaluator; `service.ts` stores option sets | 6.7 |
| `src/events` | `ingestEvent`: the one entry point for every shipment change (HTTP and simulator) | 5.6 |
| `src/shipments` | State machine, geometry (lat/lng to km), reads, ETA recompute, stale tick | 5.3, 6.2 |
| `src/alerts`, `src/notify` | Alert open/escalate/resolve; in-app notifications | 6.4, 8 |
| `src/decisions` | Decision service, ledger outcome | 5.7.3, 6.8 |
| `src/sim` | Simulated clock, fixture loader, seed, replay simulator, demo endpoints | 10.4 |
| `src/auth` | scrypt passwords, HS256 tokens, `scopeFor(user)`, login rate limit | 9.1 |
| `src/stream` | Server-sent change hints | 5.8 |
| `src/dashboard` | On-time, delay causes, impact metrics | 10.3 |
| `src/http` | Zod schemas (the contract), route helper, OpenAPI, error format | 5 |

## Deployment

- Start command: `npm start` (runs `src/server.ts` with `tsx`; no build step).
- Environment variables: `PORT`, `JWT_SECRET` (required, at least 16 characters), `CORS_ORIGINS` (comma-separated web origins), `DATABASE_FILE`, `DEMO_MODE` (`true` for the demo).
- **Exactly one instance may run.** SQLite is a single file with one writer, and the stream hub and the simulator live in process memory. Do not scale horizontally or run two copies against the same file.
- In demo mode the database is reseeded on every start, so an ephemeral disk is fine.
- Nothing has been deployed yet; hosting is open item O2.

## Branching

`main` always runs. Work happens on `feat/<area>-<short-name>` branches and merges by pull request with one review.
