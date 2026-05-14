# payment-ops-prototype-lab

Local-first prototype monorepo for three payment operations services: SMS delivery,
receipt recognition, and dynamic branded layout generation. The project is built
to demonstrate replaceable provider adapters, OCR normalization, dynamic API
contracts, queues, persistence, and a small frontend demo without requiring paid
external services.

## Current Status

Phase 2 SMS Gateway is in place:

- pnpm workspace and Turborepo task wiring;
- shared TypeScript, ESLint, config, logger, and type packages;
- Docker Compose for PostgreSQL and Redis;
- local environment example;
- `apps/sms-gateway` NestJS service with PostgreSQL persistence, Redis/BullMQ
  queueing, mock SMS providers, fallback, idempotency protection, and Swagger.

## Prerequisites

- Node.js 22 or newer with Corepack available.
- pnpm `11.0.9`.
- Docker Desktop or another Docker Compose compatible runtime.

## Setup

```bash
corepack enable
corepack prepare pnpm@11.0.9 --activate
pnpm install
cp .env.example .env
pnpm docker:up
pnpm --filter @payment-ops/sms-gateway prisma:generate
pnpm --filter @payment-ops/sms-gateway prisma:deploy
pnpm lint
pnpm typecheck
```

Use `pnpm docker:down` to stop local infrastructure and `pnpm docker:logs` to
follow container logs.

## Workspace

```text
apps/
  sms-gateway/
packages/
  eslint-config/
  shared-config/
  shared-logger/
  shared-types/
  tsconfig/
docs/
```

Root scripts:

```bash
pnpm build
pnpm dev
pnpm lint
pnpm test
pnpm typecheck
pnpm docker:up
pnpm docker:down
pnpm docker:logs
```

## Services

- `sms-gateway`: implemented in Phase 2. It routes queued SMS jobs through mock
  country-based providers by default, stores message state in PostgreSQL,
  processes sends with Redis/BullMQ, prevents accidental duplicate sends with an
  optional `Idempotency-Key` header, and exposes Swagger at `/docs`. Optional real
  Fast2SMS support is behind explicit env flags.
- `receipt-recognizer`: planned for Phase 3. It will upload receipt screenshots,
  run OCR, normalize extracted payment data, and fall back to local regex parsing
  when optional providers are unavailable.
- `layout-builder`: planned for Phase 4. It will create per-brand dynamic API
  contracts, extract palettes from logos, and render deterministic SVG layouts.
- `builder-frontend`: planned for Phase 5. It will provide a compact local demo
  UI for the backend flows.

## Offline By Default

The base demo path must run locally without Anthropic, OpenAI, Twilio, Fast2SMS,
Gemini, or any paid provider key. Optional integrations are allowed only behind
explicit env flags and must fall back to local implementations when keys are
missing, quotas are exhausted, or providers fail.

## Documentation

- [Architecture](./docs/architecture.md)
- [Phase 2 SMS Gateway Plan](./docs/phase-2-sms-gateway.md)
- [Service Requirements](./docs/service-requirements.md)
