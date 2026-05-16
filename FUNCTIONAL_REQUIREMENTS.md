# Terralore Functional Requirements

## 1. Purpose

This document defines functional requirements for Terralore, an interactive map-based application that generates location-specific historical timelines.

## 2. Product Scope

Terralore shall allow users to:

1. Select a geographic location via an interactive map.
2. Request a timeline of historically significant events for that location.
3. View ranked events with concise narratives and source references.

## 3. Actors

1. End User: explores map locations and consumes generated timelines.
2. System Operator: configures API keys, deployment settings, and monitoring.
3. External Providers: geocoding, LLM, and cache/persistence services.

## 4. Functional Requirements

### 4.1 Map Interaction and Location Selection

1. The system shall provide an interactive world map UI.
2. The user shall be able to place or move a pin on the map.
3. The system shall capture the pin's latitude and longitude on each selection.
4. The system shall display the currently selected location coordinates.

### 4.2 Reverse Geocoding and Location Context

1. The backend shall resolve coordinates to location context (place label, city/region/country when available).
2. The system shall normalize geocoding responses into a consistent internal shape.
3. If geocoding fails, the system shall return a structured error response.

### 4.3 Timeline Generation

1. The system shall submit normalized location context to an LLM provider through backend services.
2. The system shall request a bounded number of events (configurable max).
3. Each event shall include, at minimum:
   - identifier
   - title
   - summary
   - date label
   - significance score
   - confidence score
   - source list
4. The system shall return timeline responses with generated timestamp and cache-hit status.
5. If timeline generation fails, the system shall return a structured error response.

### 4.4 Caching

1. The backend shall check cache before invoking geocoding or LLM providers.
2. Cached timeline responses shall be keyed by normalized location context and request parameters.
3. Cache entries shall include creation time and expiry metadata.
4. On cache hit, the system shall return cached data and indicate cacheHit = true.

### 4.5 API Behavior

1. The system shall expose a health endpoint for runtime checks.
2. The system shall expose an API endpoint for timeline requests.
3. API responses shall be JSON and match shared contract types.
4. Not-found routes shall return a 404 JSON response.
5. Unhandled server errors shall return a 500 JSON response without leaking secrets.

### 4.6 Validation and Guardrails

1. The backend shall validate all timeline request payloads.
2. Latitude/longitude values shall be range-validated.
3. maxEvents shall be constrained to an allowed range.
4. The system shall sanitize provider responses before returning data to clients.

### 4.7 Client Rendering

1. The client shall render loading, success, and error states distinctly.
2. The client shall render timeline events in deterministic order.
3. The client shall show location context alongside timeline results.

### 4.8 Observability and Auditability

1. The system shall log backend request failures with redacted payloads.
2. The system shall include correlation-friendly metadata in error logs.
3. The system shall support audit workflows by keeping docs synchronized with behavior.

## 5. Security and Policy Requirements

1. The client shall never directly call the LLM provider.
2. Secrets shall never be exposed in frontend code or API responses.
3. API keys shall be loaded from server environment variables only.
4. The system shall avoid persisting precise coordinates unless explicitly required.

## 6. Documentation Requirements

1. README.md shall reflect current commands and architecture.
2. AGENTS.md shall reflect coding conventions and commit message format.
3. code-audit-checklist.md shall enforce doc synchronization checks.
4. Functional requirement changes shall be versioned in this document.

## 7. Out of Scope (Current Phase)

1. Full user authentication and account management.
2. Multi-tenant data isolation.
3. Advanced personalization and recommendation models.
4. Offline mode.

## 8. Future Functional Expansion

1. Time-range filtering for events.
2. Multi-language timeline output.
3. Source quality scoring and citation drill-down.
4. Interactive timeline comparisons between locations.

## 9. Acceptance Criteria Baseline

A baseline increment is accepted when all of the following are true:

1. A user can select a location and submit a timeline request.
2. The backend returns either a valid timeline contract or a structured error.
3. Cache-check behavior is present before provider calls.
4. Lint, typecheck, and format checks pass.
5. README.md and AGENTS.md are updated if behavior or commands changed.
