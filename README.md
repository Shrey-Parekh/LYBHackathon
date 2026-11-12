# Order-to-Delivery Control Tower

LYB Mumbai Hackathon 2026, Round 2, Problem Statement 3. Tracks bulk polymer shipments from plant to customer, predicts delays with an explainable rules engine, suggests actions for a coordinator to approve, and gives the coordinator, driver and customer one shared view.

All data is **fictional**. Plant X is a fictional company.

## Repository layout

| Folder | Contents |
|---|---|
| [`frontend/`](frontend/) | React + Vite web app for all three roles, with an in-browser mock API. See [frontend/README.md](frontend/README.md) |
| [`backend/`](backend/) | API service (Node, TypeScript, Fastify), and the canonical [DESIGN.md](backend/DESIGN.md), [PHASES.md](backend/PHASES.md) and [AI_USAGE.md](backend/AI_USAGE.md) |
| [`database/`](database/) | Database schema, migrations and fictional seed data |

## Quick start (frontend, no backend needed)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173 and use a demo account from the login page.

## Generative AI

AI coding agents were used for the design documents and the code. See [backend/AI_USAGE.md](backend/AI_USAGE.md).
