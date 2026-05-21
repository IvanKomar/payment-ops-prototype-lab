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

### Phase 6 Target: AI-Generated Brand Payment Platform

The next project direction is documented separately in
[phase-6-ai-brand-payment-platform.md](./phase-6-ai-brand-payment-platform.md).
The key pivot is to move payment ownership out of Layout Builder into a
dedicated payment core, then let AI-generated brand interfaces talk only to
brand-specific API facades that map back to the canonical payment service.

`apps/payment-core` now exists as the Phase 6 foundation service. It provides
brand-scoped auth, session tokens, account-scoped payment history, local payment
simulation, and the initial 10-status state machine.

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

Default local pipeline:

```text
Upload -> multer -> Tesseract.js -> Normalizer -> Zod validation -> DB
```

Optional Gemini pipeline:

```text
Upload -> multer -> Gemini image recognition -> Zod validation -> DB
```

Recognition strategy:

- `tesseract` - default offline implementation. Runs Tesseract.js and
  `RegexNormalizer`.
- `gemini` - optional free-tier image-to-JSON support behind upload
  `model=gemini`, `GEMINI_ENABLED=true`, and `GEMINI_API_KEY`.
- The default Gemini API model is `gemini-2.5-flash-lite`.
- If Gemini is unavailable or returns invalid output, the service falls back to
  `tesseract` and persists both `requestedModel` and `recognitionModel`.
- `AnthropicNormalizer` remains a future placeholder, not a required V1 path.

Privacy rule: free-tier LLM usage may be used by providers to improve their
products. Do not send real PII in the demo without masking.

Main API:

- `POST /receipts/upload`
- `GET /receipts/recent`
- `GET /receipts/:id`
- `GET /receipts/:id/raw`

Persistence:

- `receipts`

UI:

- server-rendered static page at `/`;
- upload form with `tesseract` / `gemini` selector;
- parsed result panel, raw OCR view, and recent receipt history;
- confidence shown as a color-coded percentage badge.

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
4. Store sanitized logo on disk and canonical field mapping.
5. Expose a per-brand dynamic API endpoint for reads and writes.
6. Render the final SVG layout and SSR brand app from the latest accepted brand
   API payload.

Static API:

- `POST /brands`
- `GET /brands/recent`
- `GET /brands/:id/schema`
- `DELETE /brands/:id`
- `GET /brands/:id/layout`

Dynamic Brand API:

- `GET /brands/:id/:slug`
- `GET /brands/:id/:slug/data`
- `GET /brands/:id/:slug/app`
- `POST /brands/:id/:slug`

The dynamic API uses the generated field names and payload structure for both
GET responses and POST bodies. Static admin endpoints create and inspect brands;
the dynamic endpoint is the brand-specific server contract. The public preview
loads the SSR app URL and the browser calls only the `/data` endpoint, keeping
schema mapping server-side.

Persistence:

- `brands`
- `brand_schemas`
- `brand_requests`

Logo support:

- Accept JPEG, PNG, WebP, and SVG logos.
- Raster palettes use `node-vibrant`.
- SVG palettes use local color extraction from sanitized SVG markup.
- Rendered SVG embeds the stored logo as base64.
- Template profiles are stable per brand and are chosen against recent brands to
  vary element placement, navigation style, metric composition, table
  density, table column order, column labels, actions, and status badge style.
- Dashboard payloads intentionally omit mode/search/filter chips and payment row
  type/method fields; preview data is limited to title, balance, currency, page
  size, and payment rows.

Layout reference:

- One template must reproduce the logic of the provided KOI-style payments
  dashboard: top bar, balance badge, report actions, refresh action, and a
  scrollable payments table.

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

Upload, selectable recognition model, OCR/normalizer fallback, fixtures,
history UI, and persistence.

### Phase 4: Layout Builder

Brand creation, palette extraction, dynamic schema generation, dynamic route
decoding, SVG logo support, brand switching UI, and SVG rendering.

### Phase 5: Frontend and Demo Polish

Vite demo UI, root README demo scripts, ADRs, and final walkthrough. The
frontend lives in `apps/builder-frontend`, runs on `http://localhost:3000`, and
uses local Vite proxy routes for the SMS Gateway, Receipt Recognizer, and Layout
Builder services.

### Phase 6: AI-Generated Brand Payment Platform

Extract a payment core, evolve Layout Builder into a brand runtime facade, add
an AI generation gateway for OpenAI/Gemini/Claude/local providers, and update
the admin console so every generated brand interface can be inspected and
tested against the shared payment system.

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
- Local startup must be simple: `pnpm install`, `pnpm run up`.
- Use Zod at service boundaries.
- Use Prisma migrations for durable state.
- The frontend should be minimal but useful for verifying network behavior.

See also: [service-requirements.md](./service-requirements.md).
