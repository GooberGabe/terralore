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

## 4. Must-Have Requirements

### MH-1: Map Interaction and Location Selection

The system shall provide an interactive world map where users can place or move a pin. On each selection, the system shall capture and display the pin's latitude and longitude.

### MH-2: Reverse Geocoding

The backend shall resolve coordinates to a human-readable location label (city, region, country). Geocoding responses shall be normalized to a consistent internal shape; failures shall return a structured error.

### MH-3: Timeline Generation

The backend shall submit normalized location context to an LLM provider and return a bounded list of events. Each event shall include at minimum: a title, summary, date label, significance score, confidence score, and source list. Timeline failures shall return a structured error.

### MH-4: API Contract and Error Handling

The system shall expose health and timeline endpoints returning JSON responses that match shared contract types. Unhandled errors shall return structured 500 responses without leaking secrets; unmatched routes shall return 404. The backend shall validate all request payloads and sanitize provider responses before returning data to clients.

### MH-5: Client Rendering

The client shall render distinct loading, error, and success states. On success, it shall display events in deterministic order alongside the resolved location label.

### MH-6: Security and Secret Isolation

API keys and provider secrets shall be loaded from server environment variables only and shall never be exposed in frontend code or API responses. The client shall never call LLM providers directly.

## 5. Stretch Requirements

### SR-1: Response Caching

The backend shall check a persistent cache before invoking geocoding or LLM providers. Cache entries shall be keyed by normalized location context and request parameters, shall include creation time and expiry metadata, and shall set `cacheHit = true` on hits.

### SR-2: Time-Range Filtering

The system shall accept optional time-range parameters (start year / end year) and restrict returned events to the specified period.

### SR-3: Multi-Language Output

The system shall support a locale parameter and return timeline narratives in the requested language.

### SR-4: Source Quality Scoring and Citation Drill-Down

Events shall include source quality scores, and the client shall offer a drill-down view linking to or citing primary sources.

## 6. Out of Scope (Current Phase)

1. Full user authentication and account management.
2. Multi-tenant data isolation.
3. Advanced personalization and recommendation models.
4. Offline mode.

## 7. Acceptance Criteria Baseline

A baseline increment is accepted when all of the following are true:

1. A user can select a location and submit a timeline request.
2. The backend returns either a valid timeline contract or a structured error.
3. Lint, typecheck, and format checks pass.
4. README.md and AGENTS.md are updated if behavior or commands changed.
