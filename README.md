# payment-ops-prototype-lab

Local-first prototype monorepo for three payment operations services: SMS delivery,
receipt recognition, and dynamic branded layout generation. The project is built
to demonstrate replaceable provider adapters, OCR normalization, dynamic API
contracts, queues, persistence, and a small frontend demo without requiring paid
external services.

## Current Status

Phase 2 SMS Gateway, Phase 3 Receipt Recognizer, Phase 4 Layout Builder, and
Phase 5 Builder Frontend are in place:

- pnpm workspace and Turborepo task wiring;
- shared TypeScript, ESLint, config, logger, and type packages;
- Docker Compose for PostgreSQL and Redis;
- local environment example;
- `apps/sms-gateway` NestJS service with PostgreSQL persistence, Redis/BullMQ
  queueing, mock SMS providers, fallback, server-side duplicate-send protection,
  and Swagger.
- `apps/receipt-recognizer` NestJS service with image upload, selectable
  Tesseract/Gemini recognition, regex fallback normalization for PhonePe
  receipts, PostgreSQL persistence, Swagger, and a small local browser UI.
- `apps/layout-builder` NestJS service with logo upload, palette extraction,
  generated per-brand API contracts, dynamic dashboard config ingestion,
  PostgreSQL persistence, SVG rendering, SSR brand app preview, Swagger, and a
  small local browser UI with a brand sidebar.
- `apps/builder-frontend` Vite demo console that brings SMS sending, receipt
  upload/history, modal brand creation, compact brand management, and live
  branded Layout Builder preview into one local UI. The preview is loaded as an
  SSR brand app and calls only the generated brand data endpoint from the
  browser.

## Prerequisites

- Node.js 22 or newer with Corepack available.
- pnpm `10.32.1`.
- Docker Desktop or another Docker Compose compatible runtime.

## First Run

Use these commands from the repository root.

### 1. Install tooling and dependencies

```bash
corepack enable
corepack prepare pnpm@10.32.1 --activate
pnpm install
cp .env.example .env
```

### 2. Start everything locally

For the usual local workflow, one command starts infrastructure, prepares the
database, and then runs all implemented apps:

```bash
pnpm run up
```

This starts:

- Builder Frontend: `http://localhost:5173`
- SMS Gateway: `http://localhost:3001`
- Receipt Recognizer: `http://localhost:3002`
- Layout Builder: `http://localhost:3003`
- Payment Core: `http://localhost:3005`

### 3. Or run setup and apps separately

```bash
pnpm run setup
pnpm run dev
```

This starts the Docker infrastructure containers and applies Prisma migrations.
Docker Compose runs only PostgreSQL on `localhost:5432` and Redis on
`localhost:6379`; the NestJS services run on your host through pnpm/Turborepo.

### 4. Smoke test the SMS Gateway

Open the combined Phase 5 demo console:

- Builder Frontend: `http://localhost:5173`

The frontend talks to the backend services through Vite proxy routes
(`/sms-api`, `/receipt-api`, and `/layout-api`), so the browser stays on one
local origin.

### 5. Smoke test the SMS Gateway API

- Health check: `http://localhost:3001/health`
- Swagger UI: `http://localhost:3001/docs`

Queue a message:

```bash
curl -X POST http://localhost:3001/sms/send \
  -H "content-type: application/json" \
  -d '{
    "phoneNumber": "+919876543210",
    "message": "Your OTP is 123456",
    "metadata": {
      "source": "readme-smoke"
    }
  }'
```

Example response:

```json
{
  "jobId": "sms_...",
  "status": "queued",
  "provider": "Fast2SmsMockProvider",
  "deduplicated": false
}
```

Check status:

```bash
curl http://localhost:3001/sms/status/<jobId>
```

View the latest 10 messages:

```bash
curl http://localhost:3001/sms/recent
```

Send the same phone number and message again within five minutes to confirm
server-side duplicate-send protection. The response should reuse the same
`jobId` and return `"deduplicated": true`. After five minutes, the same request
can be queued again.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use `pnpm run docker:down` to stop local infrastructure and `pnpm run docker:logs` to
follow container logs.

Root setup scripts:

```bash
pnpm run demo            # alias for pnpm run up
pnpm run prisma:generate # generate the shared Prisma client
pnpm run db:deploy       # apply service migrations
pnpm run setup           # docker:up + prisma:generate + db:deploy
pnpm run dev             # run implemented services and frontend in parallel
pnpm run dev:frontend    # run only the Vite demo UI
pnpm run up              # setup, then run implemented services and frontend
```

## Receipt Recognizer

To run only the receipt recognizer while developing:

```bash
pnpm --filter @payment-ops/receipt-recognizer prisma:generate
pnpm --filter @payment-ops/receipt-recognizer prisma:deploy
pnpm --filter @payment-ops/receipt-recognizer dev
```

The service starts on `http://localhost:3002` when
`RECEIPT_RECOGNIZER_PORT=3002` is present in `.env` or when no port override is
set.

- Health check: `http://localhost:3002/health`
- Swagger UI: `http://localhost:3002/docs`
- Upload/history UI: `http://localhost:3002/`

Upload a receipt through the API:

```bash
curl -X POST http://localhost:3002/receipts/upload \
  -F model=tesseract \
  -F file=@apps/receipt-recognizer/test-fixtures/phonepe/phonepe-axis-bank-10000.jpg
```

Use `model=gemini` to request Gemini recognition. Gemini runs only when
`GEMINI_ENABLED=true` and `GEMINI_API_KEY` are configured; otherwise the service
records `requestedModel=gemini` and falls back to `recognitionModel=tesseract`.
The default Gemini model is `gemini-2.5-flash-lite`.

## Layout Builder

To run only the layout builder while developing:

```bash
pnpm --filter @payment-ops/layout-builder prisma:generate
pnpm --filter @payment-ops/layout-builder prisma:deploy
pnpm --filter @payment-ops/layout-builder dev
```

- Health check: `http://localhost:3003/health`
- Swagger UI: `http://localhost:3003/docs`
- Brand UI: `http://localhost:3003/`

Create a brand through the API:

```bash
curl -X POST http://localhost:3003/brands \
  -F brandName=KOI \
  -F logo=@/path/to/logo.svg
```

The service accepts JPEG, PNG, WebP, and SVG logos. Gemini is not used for V1
template generation; SVG layouts are rendered by deterministic local logic.

## Workspace

```text
apps/
  builder-frontend/
  layout-builder/
  receipt-recognizer/
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
pnpm run demo
pnpm run up
pnpm run setup
pnpm run dev
pnpm run dev:frontend
pnpm run prisma:generate
pnpm run db:deploy
pnpm run lint
pnpm run test
pnpm run typecheck
pnpm run docker:up
pnpm run docker:down
pnpm run docker:logs
```

## Services

- `sms-gateway`: implemented in Phase 2. It routes queued SMS jobs through mock
  country-based providers by default, stores message state in PostgreSQL,
  processes sends with Redis/BullMQ, prevents accidental duplicate sends with an
  server-side five-minute duplicate-send window, and exposes Swagger at `/docs`.
  Optional real Fast2SMS support is behind explicit env flags.
- `receipt-recognizer`: implemented in Phase 3. It uploads receipt screenshots,
  lets the user request `tesseract` or `gemini`, falls back to local
  Tesseract.js OCR when Gemini is unavailable, normalizes PhonePe payment data,
  stores structured fields plus raw OCR text, and exposes upload/history through
  a local web UI.
- `layout-builder`: implemented in Phase 4. It creates per-brand dynamic API
  contracts, stores uploaded logos, extracts brand palettes, accepts and returns
  dashboard data through the generated brand API endpoint, supports deleting
  demo brands, renders KOI-style SVG layouts, and serves SSR brand preview apps.
- `builder-frontend`: implemented in Phase 5. It provides a compact Vite demo
  UI for the backend flows and uses local proxy routes so the browser can drive
  all services from `http://localhost:5173`.
- `payment-core`: Phase 6 foundation service. It supports brand-scoped user
  registration/login, session tokens, account payment history, simulated local
  payments, and a Stripe-like 10-status state machine.
- Phase 6 is planned as a pivot from deterministic layout generation to an
  AI-generated brand payment platform: a payment core, brand-specific API
  facades, AI generation gateway, and admin console for inspecting every
  generated brand interface.

## Payment Core

To run only the payment core while developing:

```bash
pnpm --filter @payment-ops/payment-core prisma:generate
pnpm --filter @payment-ops/payment-core prisma:deploy
pnpm --filter @payment-ops/payment-core dev
```

- Health check: `http://localhost:3005/health`
- Swagger UI: `http://localhost:3005/docs`
- Local clickable UI: `http://localhost:3005/`

Register a brand-scoped user:

```bash
curl -X POST http://localhost:3005/auth/register \
  -H "content-type: application/json" \
  -d '{
    "brandId": "br_koi_demo",
    "email": "alex@example.com",
    "password": "local-demo-password",
    "displayName": "Alex Merchant",
    "currency": "USD"
  }'
```

Use the returned `sessionToken` as a bearer token to create a local simulated
payment:

```bash
curl -X POST http://localhost:3005/payments \
  -H "content-type: application/json" \
  -H "authorization: Bearer <sessionToken>" \
  -d '{
    "amount": 49.99,
    "destinationLabel": "settle-demo-address",
    "methodType": "card",
    "scenario": "settle"
  }'
```

Read the account's payment history:

```bash
curl http://localhost:3005/payments/history \
  -H "authorization: Bearer <sessionToken>"
```

## Offline By Default

The base demo path must run locally without Anthropic, OpenAI, Twilio, Fast2SMS,
Gemini, or any paid provider key. Optional integrations are allowed only behind
explicit env flags and must fall back to local implementations when keys are
missing, quotas are exhausted, or providers fail.

## Documentation

- [Architecture](./docs/architecture.md)
- [Phase 6 AI-Generated Brand Payment Platform](./docs/phase-6-ai-brand-payment-platform.md)
- [ADR 0001: Builder Frontend Uses Vite Proxy Routes](./docs/adr/0001-builder-frontend-vite-proxy.md)
- [Phase 2 SMS Gateway Plan](./docs/phase-2-sms-gateway.md)
- [Service Requirements](./docs/service-requirements.md)
