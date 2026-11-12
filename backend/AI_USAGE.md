# Generative AI usage declaration

The hackathon rules allow generative AI and require teams to declare where and how it was used. Undeclared use costs 10 points (brief, page 9). Keep this file current; add a row whenever AI is used for something new.

| Area | Tool | How it was used | Human check |
|---|---|---|---|
| `DESIGN.md`, `PHASES.md`, READMEs | Claude Code (Anthropic) | Drafted from the hackathon brief and the team lead's decisions | Draft under review by the team; each member must be able to explain it |
| API code in `src/`, `migrations/`, tests in `test/`, stand-in fixtures in `test/fixtures-stub/`, clarifications in `DESIGN.md` 5.6, 5.7.3, 5.9, 6.3, 6.4 | Claude Code (Anthropic), coding agent | Wrote the backend (ingestion, ETA and risk engine, alerts, options, decisions, simulator, dashboard) and its tests from `DESIGN.md`; the worked example in 6.6 is the acceptance test | Pull requests need a teammate's review; the reviewer must be able to explain each file before merging. Tests T1–T13 were run, not assumed |
| Web app in `frontend/` (all code, tests, in-browser mock API, README, CONTRACT_GAPS.md, design tokens, screenshots) | Claude Code (Anthropic, Claude Opus 5.5), coding agent. Design skills loaded: `taste-skill:minimalist-skill`, `frontend-design:frontend-design`, `ecc:motion-foundations`, `dataviz` | Wrote the web app for all three roles from `DESIGN.md` sections 5, 7, 8 and 10.5; set the design tokens; wrote 21 component tests; walked the demo in a browser against the mock API | Pull requests need a teammate's review; the reviewer must be able to explain each file before merging |

| Seed data in `database/` (generator, validator, schemas, `seed/*.json`, tests, README), the map geometry export, per-vertex chainage in `backend/src/shipments/geometry.ts`, and `backend/test/seed-demo.test.ts` | Claude Code (Anthropic, Claude Opus 5.5), coding agent | Wrote the deterministic seed generator and checks from the team lead's data brief and `DESIGN.md` 6.6 and 10.1; exported route geometry once from the public OSRM router; web-searched every invented company name | Database checks (73) and backend tests (42, four of them on the real seed) were run, not assumed; the team reviews the data and must be able to explain each tuning choice in `database/README.md` |

## Run-time AI in the product

None at present. The ETA, delay risk, alerts and option ranking are deterministic rules (DESIGN.md section 6.9). If the optional "Where is my order?" assistant is built with a language model, record it here.
