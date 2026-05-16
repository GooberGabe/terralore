# Terralore Agent Guide

## Product Summary

Terralore is an interactive world map where users drop a pin and receive a curated timeline of historically significant events for that location. The experience is geography-first: coordinates become local context, local context becomes ranked historical output, and output becomes a museum-style narrative display.

## Stack

- Frontend: React + TypeScript (Vite)
- Maps: Google Maps JavaScript API
- Backend (target): Node.js + Express.js
- APIs and AI: Google Geocoding API, Anthropic Claude API (Sonnet)
- Data and hosting (target): Firebase Firestore for caching, Vercel for deployment
- Tooling: pnpm, dotenv, ESLint, Prettier

## Project Phases

1. Foundation
2. LLM Pipeline
3. Display Layer
4. Polish and UX
5. Caching and Performance
6. Deployment

## Folder Structure

Current workspace:

- `src/main.tsx`: application bootstrap and React mount
- `src/App.tsx`: primary app shell and page composition
- `src/index.css`: global styles and design tokens
- `src/App.css`: app-scoped styles
- `src/assets/`: static frontend assets bundled by Vite
- `public/`: static files served as-is
- `server/src/index.ts`: Express server entrypoint and health endpoints
- `server/src/providers/`: provider implementations (scaffolded)
- `server/src/cache/`: caching implementations (scaffolded)

Planned structure as backend and data layers are added:

- `src/components/`: reusable presentational UI blocks
- `src/features/<feature>/`: feature-scoped UI, hooks, and tests
- `src/lib/`: pure utilities and shared helpers
- `src/services/`: API clients and server communication adapters
- `src/types/`: shared TypeScript models and API contracts
- `server/src/`: Express server, routes, middleware, provider clients
- `server/src/providers/`: geocoding and LLM provider implementations
- `server/src/cache/`: Firestore-backed caching logic

## Dev Commands

Current commands (implemented):

- `pnpm dev`: run the Vite frontend dev server
- `pnpm dev:server`: run the Express API server in watch mode
- `pnpm dev:full`: run frontend and backend concurrently
- `pnpm build`: run TypeScript build and production bundle
- `pnpm typecheck`: run TypeScript type checks without emitting
- `pnpm preview`: preview the production bundle locally
- `pnpm lint`: run ESLint with zero warnings policy
- `pnpm lint:fix`: auto-fix ESLint issues where possible
- `pnpm format`: format repository files with Prettier
- `pnpm format:check`: verify formatting without modifying files

Planned commands (add when backend is scaffolded):

- `pnpm test`: run unit and integration tests

## Coding Conventions

- Language and typing:
  - Use TypeScript everywhere (frontend and backend).
  - Avoid `any`; prefer explicit domain types and narrow unions.
- Naming:
  - React components and files: PascalCase (example: `TimelineCard.tsx`).
  - Hooks: camelCase prefixed with `use` (example: `useLocationContext.ts`).
  - Utilities, services, and variables: camelCase.
  - Constants: UPPER_SNAKE_CASE only for true constants.
- File organization:
  - Keep feature logic close to feature UI.
  - Prefer small, composable modules over large multi-purpose files.
  - Keep provider-specific logic isolated behind service/provider boundaries.
- Preferred patterns:
  - Use pure functions for ranking/transformation logic.
  - Validate and normalize external API responses before use.
  - Keep map/geocoding/LLM orchestration out of UI components.
  - Introduce thin interfaces for provider clients to allow swapping vendors.

## Explicit Constraints

- Never expose API keys or provider secrets client-side.
- Never call LLM providers directly from browser code; route through server.
- Always check cache before issuing geocoding or LLM requests.
- Always sanitize and validate external responses before rendering.
- Always implement timeout and retry limits for third-party API calls.
- Always log provider failures with redacted payloads (no secrets, no PII).
- Never persist precise user coordinates unless explicitly required and disclosed.
- Keep prompt templates and ranking criteria versioned and testable.

## Commit Message Format

Use a Conventional Commits style message for all commits.

Format:

- `<type>(<scope>): <summary>`

Rules:

- Use imperative mood in the summary (example: "add", "refactor", "fix").
- Keep summary concise and specific to observable change.
- Prefer lowercase for type and scope.
- Use one commit per logical change when feasible.

Recommended types:

- `feat`: new user-facing behavior or capability
- `fix`: bug fix or correctness issue
- `refactor`: structural change without intended behavior change
- `docs`: documentation-only changes
- `chore`: tooling, config, or maintenance updates
- `test`: tests added or updated

Suggested scopes:

- `client`
- `server`
- `types`
- `docs`
- `tooling`
- `cache`
- `providers`

Examples:

- `feat(server): add timeline route scaffold`
- `refactor(types): normalize timeline response contracts`
- `docs(agents): document explicit API key constraints`
- `chore(tooling): add typecheck script and server tsconfig`
