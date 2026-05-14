# Project Architecture

`payment-ops-prototype-lab` is a local prototype monorepo with three NestJS
services. Its goal is to demonstrate architectural thinking around provider
abstractions, OCR normalization, dynamic API contracts, queues, persistence, and
a small frontend demo.

This is not a production system. The base demo path must run locally without
paid services or required external API keys.

## Core Constraints

- The base demo uses local tools, mocks, or simulators.
- There are no required API keys for Anthropic, OpenAI, Twilio, Fast2SMS, Gemini,
  or other external providers.
- Optional free-tier integrations are allowed only behind explicit env flags.
- If an optional provider fails, exhausts quota, or has no key, the service must
  fall back to a local implementation.
- The implementation should emphasize clear interfaces and replaceable adapters,
  not production infrastructure.

## Technical Stack

- Monorepo: Turborepo + pnpm workspaces
- Backend: NestJS + TypeScript strict mode
- Database: PostgreSQL through Prisma
- Queue: Redis + BullMQ where async flow is genuinely useful
- Validation: Zod for DTO/runtime validation
- OCR: Tesseract.js
- Color extraction: node-vibrant
- Frontend: Vite with plain TypeScript or React, without a UI component library
- Containerization: Docker Compose
- API docs: Swagger

## Target Repository Structure

```text
platform/
├── apps/
│   ├── sms-gateway/
│   ├── receipt-recognizer/
│   ├── layout-builder/
│   └── builder-frontend/
├── packages/
│   ├── shared-types/
│   ├── shared-config/
│   ├── shared-logger/
│   ├── eslint-config/
│   └── tsconfig/
├── docs/
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

## Services

### SMS Gateway

Purpose: send SMS through country-based provider routing.

Default providers are mocks:

- `KyivstarMockProvider` for `+380`
- `Fast2SmsMockProvider` for `+91`
- `VonageMockProvider` for `+49`, `+33`, `+44`
- `TwilioMockProvider` as the global fallback for all other valid E.164 numbers

Optional real adapter:

- `Fast2SmsProvider`, enabled only with `FAST2SMS_ENABLED=true` and
  `FAST2SMS_API_KEY`.
- The adapter uses Fast2SMS `POST https://www.fast2sms.com/dev/bulkV2` with an
  `authorization` header.
- Tests and default demos must never call the real provider.

Main API:

- `POST /sms/send`
- `GET /sms/status/:jobId`

Persistence:

- `sms_messages`

### Receipt Recognizer

Purpose: upload receipt screenshots, run OCR, normalize text into structured
payment data, and persist the result.

Pipeline:

```text
Upload -> multer -> Tesseract.js -> Normalizer -> Zod validation -> DB
```

Normalizer strategy:

- `RegexNormalizer` - default offline implementation.
- `GeminiNormalizer` - optional free-tier support behind `NORMALIZER=gemini`,
  `GEMINI_ENABLED=true`, and `GEMINI_API_KEY`.
- `AnthropicNormalizer` - placeholder showing provider readiness, but it must
  gracefully fall back without an API key.

Privacy rule: free-tier LLM usage may be used by providers to improve their
products. Do not send real PII in the demo without masking.

Main API:

- `POST /receipts/upload`
- `GET /receipts/:id`
- `GET /receipts/:id/raw`

Persistence:

- `receipts`

Fixtures:

- Store provided PhonePe screenshots in
  `apps/receipt-recognizer/test-fixtures/phonepe/`.
- The regex parser must support `Transaction Successful`, `Paid to`,
  `Banking Name`, `Transaction ID`, `Debited from`, `UTR`, and INR amounts.

### Layout Builder

Purpose: generate branded layouts with a dynamic per-brand API contract.

Flow:

1. Upload logo and brand name.
2. Extract palette through `node-vibrant`.
3. Generate a unique endpoint slug and randomized field names.
4. Store canonical field mapping.
5. Accept brand configuration through the dynamic endpoint.
6. Render the final SVG layout.

Static API:

- `POST /brands`
- `GET /brands/:id/schema`
- `GET /brands/:id/layout`

Dynamic API:

- `POST /brands/:id/:slug`

Persistence:

- `brands`
- `brand_schemas`
- `brand_requests`

Layout reference:

- One template must reproduce the logic of the provided KOI-style payments
  dashboard: top bar, balance badge, filters, report actions, refresh action, and
  a scrollable payments table.

## Implementation Phases

### Phase 1: Foundation

Create the foundation monorepo, shared packages, Docker infrastructure, and a
clear README. This phase does not implement business logic.

Detailed service requirements: [service-requirements.md](./service-requirements.md).

### Phase 2: SMS Gateway

First end-to-end backend service: providers, routing, queue, database, Swagger,
and focused tests.

Detailed plan and implementation notes:
[phase-2-sms-gateway.md](./phase-2-sms-gateway.md).

### Phase 3: Receipt Recognizer

Upload, OCR, normalizer strategy, fixtures, and fallback behavior.

### Phase 4: Layout Builder

Brand creation, palette extraction, dynamic schema generation, dynamic route
decoding, and SVG rendering.

### Phase 5: Frontend and Demo Polish

Vite demo UI, root README demo scripts, ADRs, and final walkthrough.

## Non-Goals

- Auth system beyond a simple optional `X-API-Key` demo guard.
- Production logging, metrics, tracing, or monitoring stack.
- Kubernetes, CI/CD, or cloud deployment.
- Large test coverage. Each service needs a few meaningful tests, not a
  production test suite.
- Required real API keys.
- Paid services.

## Engineering Principles

- Prefer replaceable interfaces for every external integration.
- Mocks must be realistic enough: latency, failure, fallback, and status polling.
- Local startup must be simple: `pnpm install`, `pnpm docker:up`, `pnpm dev`.
- Use Zod at service boundaries.
- Use Prisma migrations for durable state.
- The frontend should be minimal but useful for verifying network behavior.

See also: [service-requirements.md](./service-requirements.md).
