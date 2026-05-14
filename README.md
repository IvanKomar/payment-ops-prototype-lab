# payment-ops-prototype-lab

Local-first prototype monorepo for three payment operations services: SMS delivery,
receipt recognition, and dynamic branded layout generation. The project is built
to demonstrate replaceable provider adapters, OCR normalization, dynamic API
contracts, queues, persistence, and a small frontend demo without requiring paid
external services.

## Current Status

Phase 2 SMS Gateway is in place and Phase 3 Receipt Recognizer has been added:

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

### 2. Start local infrastructure

```bash
pnpm docker:up
```

This starts PostgreSQL on `localhost:5432` and Redis on `localhost:6379`.

### 3. Prepare the SMS Gateway database

```bash
pnpm --filter @payment-ops/sms-gateway prisma:generate
pnpm --filter @payment-ops/sms-gateway prisma:deploy
```

### 4. Run the SMS Gateway

```bash
pnpm --filter @payment-ops/sms-gateway dev
```

The service starts on `http://localhost:3001`.

- Health check: `http://localhost:3001/health`
- Swagger UI: `http://localhost:3001/docs`

### 5. Smoke test the API

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

Use `pnpm docker:down` to stop local infrastructure and `pnpm docker:logs` to
follow container logs.

## Receipt Recognizer

Prepare the database and start the service:

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

## Workspace

```text
apps/
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
  server-side five-minute duplicate-send window, and exposes Swagger at `/docs`.
  Optional real Fast2SMS support is behind explicit env flags.
- `receipt-recognizer`: implemented in Phase 3. It uploads receipt screenshots,
  lets the user request `tesseract` or `gemini`, falls back to local
  Tesseract.js OCR when Gemini is unavailable, normalizes PhonePe payment data,
  stores structured fields plus raw OCR text, and exposes upload/history through
  a local web UI.
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
