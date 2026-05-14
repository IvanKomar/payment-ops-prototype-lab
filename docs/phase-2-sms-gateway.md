# Phase 2: SMS Gateway Plan

This document plans and records Phase 2 based on the repository state after
Phase 1. The Phase 2 result is the first end-to-end backend service in the
monorepo: a NestJS API with provider abstraction, country routing, BullMQ queue,
Prisma persistence, Swagger, server-side duplicate-send protection, and focused tests.

## Implementation Status

Implemented in `apps/sms-gateway` with a service-local Prisma schema, NestJS
controllers, BullMQ processing, mock providers, optional Fast2SMS adapter,
server-side duplicate-send protection, Swagger setup, and focused tests. The
implementation uses Prisma 6.x because Prisma 7 removed datasource URLs from
`schema.prisma`, which would add unnecessary configuration complexity for this
prototype phase.

## Current Repository State

Already available:

- root pnpm workspace with `pnpm@11.0.9`;
- Turborepo tasks: `build`, `dev`, `lint`, `test`, `typecheck`;
- shared packages:
  - `@payment-ops/tsconfig`;
  - `@payment-ops/eslint-config`;
  - `@payment-ops/shared-types`;
  - `@payment-ops/shared-config`;
  - `@payment-ops/shared-logger`;
- Docker Compose for PostgreSQL and Redis;
- `.env.example` with base `DATABASE_URL`, `REDIS_URL`, and `LOG_LEVEL`;
- `apps/sms-gateway` as the first backend service.

Phase 2 builds on this foundation without changing the Phase 1 direction.

## Scope

Phase 2 includes:

- creating `apps/sms-gateway`;
- NestJS HTTP API;
- Zod validation at the service boundary;
- Swagger documentation for `POST /sms/send`, `GET /sms/status/:jobId`, and
  `GET /sms/recent`;
- Prisma schema and migration for `sms_messages`;
- BullMQ queue for asynchronous SMS sending;
- provider abstraction and mock providers;
- country-based routing with a global fallback for all valid E.164 numbers;
- fallback between providers;
- server-side duplicate-send protection for matching phone number and message
  within five minutes;
- optional `Fast2SmsProvider` behind env flags;
- focused unit/integration tests;
- service README.

Phase 2 does not include:

- Receipt Recognizer;
- Layout Builder;
- frontend;
- auth system;
- production observability;
- real SMS calls in tests or in the default demo;
- complex retry orchestration beyond a clear prototype flow.

## Target Structure

```text
apps/sms-gateway/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── config/
│   │   ├── env.schema.ts
│   │   └── sms-gateway.config.ts
│   ├── health/
│   │   ├── health.controller.ts
│   │   └── health.service.ts
│   ├── prisma/
│   │   └── prisma.service.ts
│   └── sms/
│       ├── controllers/
│       │   └── sms.controller.ts
│       ├── dto/
│       │   └── sms.schemas.ts
│       ├── providers/
│       │   ├── fast2sms.provider.ts
│       │   ├── mock-provider.base.ts
│       │   ├── provider-registry.ts
│       │   ├── provider.types.ts
│       │   └── mocks/
│       │       ├── fast2sms-mock.provider.ts
│       │       ├── kyivstar-mock.provider.ts
│       │       ├── twilio-mock.provider.ts
│       │       └── vonage-mock.provider.ts
│       ├── queue/
│       │   ├── sms.processor.ts
│       │   └── sms.queue.ts
│       ├── sms.module.ts
│       ├── sms.repository.ts
│       ├── sms.service.ts
│       └── sms.types.ts
├── test/
├── eslint.config.mjs
├── package.json
├── README.md
├── tsconfig.json
└── tsconfig.build.json
```

## API Contract

### `POST /sms/send`

Request:

```http
POST /sms/send
Content-Type: application/json
```

```json
{
  "phoneNumber": "+919876543210",
  "message": "Your OTP is 123456",
  "metadata": {
    "source": "demo"
  }
}
```

Response:

```json
{
  "jobId": "sms_...",
  "status": "queued",
  "provider": "Fast2SmsMockProvider",
  "deduplicated": false
}
```

Behavior:

- validate the body with Zod;
- choose the initial provider synchronously before queueing;
- if the same phone number and message were queued in the last five minutes,
  return the existing job instead of enqueueing a second send;
- persist a `sms_messages` row with `queued` status and a server-generated
  idempotency key;
- enqueue a BullMQ job with `jobId`;
- return a queued response immediately.

Duplicate handling is local and based on server time, so client locations and
time zones do not affect the five-minute window.

### `GET /sms/status/:jobId`

Response:

```json
{
  "jobId": "sms_...",
  "status": "sent",
  "provider": "Fast2SmsMockProvider",
  "attempts": 1,
  "lastError": null
}
```

Behavior:

- read canonical status from the database;
- return `404` for unknown `jobId`;
- include selected/current provider, attempts, and last error.

### `GET /sms/recent`

Response:

```json
[
  {
    "jobId": "sms_...",
    "phoneNumber": "+919876543210",
    "message": "Your OTP is 123456",
    "status": "sent",
    "provider": "Fast2SmsMockProvider",
    "attempts": 1,
    "lastError": null,
    "dedupeKey": "server:...",
    "createdAt": "2026-05-14T11:00:00.000Z",
    "sentAt": "2026-05-14T11:00:01.000Z"
  }
]
```

Behavior:

- return the latest 10 persisted messages;
- order newest first by `createdAt`;
- expose server timestamps as ISO strings.

### `GET /health`

Small health endpoint for local verification:

```json
{
  "service": "sms-gateway",
  "status": "ok",
  "uptimeSeconds": 12,
  "timestamp": "2026-05-13T17:30:00.000Z"
}
```

Use `HealthResponse` from `@payment-ops/shared-types`.

## Persistence

Use a service-local Prisma schema in `apps/sms-gateway/prisma/schema.prisma`.

Initial model:

```prisma
model SmsMessage {
  id                 String    @id
  phoneNumber        String
  message            String
  idempotencyKey     String?   @unique
  metadata           Json?
  status             SmsStatus
  selectedProvider   String
  providerMessageId  String?
  attempts           Int       @default(0)
  lastError          String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  sentAt             DateTime?
}

enum SmsStatus {
  queued
  processing
  sent
  failed
}
```

Recommended `jobId` format: `sms_` + collision-resistant random id. The service
owns this id and uses it as both API id and DB primary key.

Use the persisted `idempotencyKey` column for a server-generated key derived
from phone number, message, and a five-minute server-time window. Before
queueing, also check for an existing message with the same phone number and
message created in the previous five minutes. If found, return the existing job
with `deduplicated: true`.

## Queue Flow

Use BullMQ with Redis from `REDIS_URL`.

Flow:

1. `POST /sms/send` validates the payload.
2. `SmsService` checks for an existing same phone number and message from the
   last five minutes using server time.
3. If an equivalent message already exists, the service returns that job without
   queueing another BullMQ job.
4. `SmsService` selects the initial provider using `ProviderRegistry`.
5. The service creates a `SmsMessage` row with `queued` status.
6. The service adds a BullMQ job to `sms-send`.
7. The processor loads the message and marks it `processing`.
8. The processor calls the selected provider.
9. On success, the DB row becomes `sent`.
10. On provider failure, the processor asks the registry for the next fallback
    provider.
11. If fallback succeeds, the DB row becomes `sent` with the fallback provider
    name.
12. If all providers fail, the DB row becomes `failed` with `lastError`.

Keep BullMQ retry settings conservative. Provider fallback should be explicit in
service code, not hidden behind many queue retries.

## Provider Design

Local service interface:

```ts
export interface ISmsProvider {
  readonly name: string;
  canHandle(phoneNumber: string): boolean;
  send(input: SmsSendInput): Promise<SmsSendResult>;
  getStatus(providerMessageId: string): Promise<SmsProviderStatus>;
}
```

Provider routing:

- `+380` -> `KyivstarMockProvider`;
- `+91` -> `Fast2SmsMockProvider`;
- `+49`, `+33`, `+44` -> `VonageMockProvider`;
- all other valid E.164 numbers worldwide -> `TwilioMockProvider`.

`TwilioMockProvider` is the global catch-all route. The service does not need one
mock provider per country to route every country; country-specific providers are
preferred when configured, and all remaining valid E.164 numbers use the global
mock provider.

Fallback order:

1. selected country provider;
2. `VonageMockProvider`, if it is not the selected provider;
3. `TwilioMockProvider`, if it is not the selected provider;
4. remaining mock providers in stable registration order.

This keeps fallback deterministic and easy to test.

Mock behavior:

- configurable success rate;
- configurable min/max latency;
- deterministic test mode with zero latency and controlled failures;
- no network calls.

Provider config can be service-local. Do not centralize provider-specific env vars
in `@payment-ops/shared-config`.

## Optional Fast2SMS Adapter

Real adapter name: `Fast2SmsProvider`.

Activation rules:

- enabled only when `FAST2SMS_ENABLED=true`;
- requires `FAST2SMS_API_KEY`;
- otherwise the registry uses `Fast2SmsMockProvider`;
- tests and default demos must never call the real provider.

Implementation approach:

- use native `fetch` from the Node runtime;
- endpoint: `POST https://www.fast2sms.com/dev/bulkV2`;
- auth header: `authorization`;
- keep the request builder isolated and covered by tests with mocked fetch;
- do not add a Fast2SMS SDK in Phase 2.

## Configuration

Service env schema uses `@payment-ops/shared-config`.

Expected service env vars:

```text
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/payment_ops?schema=public
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info

SMS_MOCK_MIN_LATENCY_MS=100
SMS_MOCK_MAX_LATENCY_MS=800
SMS_MOCK_SUCCESS_RATE=0.95

FAST2SMS_ENABLED=false
FAST2SMS_API_KEY=
```

Update root `.env.example` only when a variable is actually consumed by the
implemented service.

## Dependencies

App dependencies:

- NestJS core/platform packages;
- Swagger package for API docs;
- Zod;
- Prisma client;
- BullMQ and Nest integration for queues;
- shared logger/config/type packages;
- test runner dependencies local to the app.

Keep dependency additions service-scoped where possible. Root dev dependencies
should only receive tooling that is truly workspace-wide.

## Testing Plan

Minimum tests:

- provider routing:
  - `+380` -> `KyivstarMockProvider`;
  - `+91` -> `Fast2SmsMockProvider`;
  - `+49`, `+33`, `+44` -> `VonageMockProvider`;
  - unknown valid E.164 prefixes -> `TwilioMockProvider`;
- fallback:
  - selected provider fails;
  - next provider succeeds;
  - DB status records fallback provider and attempt count;
- validation:
  - invalid phone number rejected;
  - empty message rejected;
- duplicate-send protection:
  - repeated same phone number and message inside five minutes returns existing
    job;
  - same phone number and message after five minutes can queue again;
  - duplicate request inside the window does not enqueue a second BullMQ job;
- API/controller:
  - `POST /sms/send` returns queued job;
  - `GET /sms/status/:jobId` returns persisted status;
  - `GET /sms/recent` returns the latest 10 messages;
  - unknown `jobId` returns `404`;
- Fast2SMS:
  - disabled by default;
  - missing key falls back to mock;
  - request builder sends the `authorization` header when enabled.

For this environment, tests avoid opening a local HTTP listener because the
sandbox can block socket binds. Controller, validation, provider, fallback, and
adapter behavior are tested directly.

## Implementation Order

1. Scaffold `apps/sms-gateway` package and scripts.
2. Add NestJS bootstrap, health endpoint, config parsing, and logger wiring.
3. Add Prisma schema, migration, Prisma service, and repository.
4. Add SMS DTO Zod schemas and controller.
5. Add provider interfaces, mock providers, and registry.
6. Add BullMQ queue and processor.
7. Implement fallback and status transitions.
8. Add optional `Fast2SmsProvider` behind env flags.
9. Add Swagger setup and service README.
10. Add focused tests.
11. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
12. Verify local demo path with Docker running.

## Definition of Done

Phase 2 is done when:

- `apps/sms-gateway` starts locally with `pnpm dev`;
- `POST /sms/send` returns a queued job;
- duplicate `POST /sms/send` with the same phone number and message inside five
  minutes does not send twice;
- the same phone number and message can be queued again after five minutes;
- `GET /sms/status/:jobId` returns persisted status;
- `GET /sms/recent` returns the latest 10 persisted SMS messages;
- mock providers route by country prefix and route all other valid E.164 numbers
  through the global fallback provider;
- fallback is deterministic and tested;
- PostgreSQL stores SMS message state;
- Redis/BullMQ processes queued sends;
- Swagger is available for the SMS API;
- `FAST2SMS_ENABLED=false` is the default path;
- no default test or demo path requires a real external API key;
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Review Questions Before Implementation

- Should `PORT=3001` be the default for SMS Gateway, reserving `3002` and `3003`
  for later services?
- Is one service-local Prisma schema per app acceptable for this prototype, or
  do we want a single root Prisma schema from Phase 2 onward?
- Should the default fallback order prefer `TwilioMockProvider` immediately after
  the selected provider, or keep `VonageMockProvider` before Twilio for EU-like
  routing behavior?
- Do we want Phase 2 to include a small Postman/HTTP examples file, or keep API
  examples only in Swagger and README?
