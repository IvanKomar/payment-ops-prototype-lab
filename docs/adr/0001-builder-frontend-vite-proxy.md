# ADR 0001: Builder Frontend Uses Vite Proxy Routes

## Status

Accepted

## Context

Phase 5 needs a compact local UI that demonstrates the three backend flows
without adding production deployment infrastructure. The existing NestJS
services run on separate ports and do not enable browser CORS.

## Decision

Add `apps/builder-frontend` as a Vite workspace app. The browser uses relative
paths:

- `/sms-api`
- `/receipt-api`
- `/layout-api`

Vite proxies those routes to the local backend services during development.

## Consequences

- The demo runs from one browser origin at `http://localhost:3000`.
- Backend services do not need CORS changes for the local walkthrough.
- The app remains local-demo focused. A production deployment would need an
  equivalent reverse proxy or explicit backend API base URLs.
