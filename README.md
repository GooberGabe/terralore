# Terralore

Terralore is a geography-first history experience. A user drops a pin on the map, and the app returns a curated timeline of historically significant events for that location.

## Current Status

- Frontend scaffolded with React + TypeScript + Vite
- Backend scaffolded with Node.js + Express
- Shared domain types established for timeline and location contracts
- Linting and formatting standardized with ESLint + Prettier

## Product Vision

1. Convert coordinates into location context via reverse geocoding.
2. Generate high-signal local history timelines with an LLM.
3. Cache results to reduce latency and provider cost.
4. Present results in a polished, exploration-first UI.

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Express, TypeScript
- APIs and AI (planned): Google Geocoding API, Anthropic Claude
- Caching and persistence (planned): Firebase Firestore
- Tooling: pnpm, ESLint, Prettier

## Repository Layout

```text
.
|- src/
|  |- App.tsx
|  |- main.tsx
|  |- types/
|  |  |- index.ts
|- server/
|  |- src/
|  |  |- index.ts
|  |  |- routes/
|  |  |- middleware/
|  |  |- services/
|  |  |- providers/
|  |  |- cache/
|  |  |- config/
|- AGENTS.md
|- code-audit-checklist.md
|- FUNCTIONAL_REQUIREMENTS.md
```

## Development Commands

- `pnpm dev`: start frontend dev server
- `pnpm dev:server`: start backend server in watch mode
- `pnpm dev:full`: run frontend and backend together
- `pnpm build`: typecheck and build frontend bundle
- `pnpm typecheck`: run TypeScript project checks
- `pnpm lint`: run ESLint with zero warnings allowed
- `pnpm lint:fix`: auto-fix lint issues where possible
- `pnpm format`: apply Prettier formatting
- `pnpm format:check`: verify formatting
- `pnpm preview`: preview production frontend build

## Backend Endpoints (Current)

- `GET /health`: service health check
- `GET /api/timeline`: scaffolded endpoint (currently returns 501 Not Implemented)

## Environment Variables

Backend server supports:

- `PORT`: server port (default `8787`)
- `NODE_ENV`: `development`, `test`, or `production`

Planned provider variables (not yet wired):

- `GOOGLE_MAPS_API_KEY`
- `ANTHROPIC_API_KEY`
- `FIREBASE_PROJECT_ID` and related service credentials

## Architecture Notes

- Browser must never call LLM providers directly.
- API keys must never be exposed client-side.
- Cache should be checked before geocoding or LLM calls.
- Provider logic should stay behind service/provider interfaces.

See [AGENTS.md](AGENTS.md) for project conventions and commit format.
See [FUNCTIONAL_REQUIREMENTS.md](FUNCTIONAL_REQUIREMENTS.md) for product-level requirements.

## Next Milestones

1. Implement timeline service orchestration in backend.
2. Add geocoding and LLM provider adapters.
3. Implement cache-first flow.
4. Connect frontend map interactions to backend timeline endpoint.
5. Add tests for contracts and service behavior.
