# Phase 2: SMS Gateway Plan

Цей документ планує Phase 2 з урахуванням поточного стану репозиторію після
Phase 1. Результат Phase 2 має бути першим end-to-end backend service у
монорепо: NestJS API, provider abstraction, country routing, BullMQ queue,
Prisma persistence, Swagger і focused tests.

## Current Repository State

Вже є:

- root pnpm workspace з `pnpm@11.0.9`;
- Turborepo tasks: `build`, `dev`, `lint`, `test`, `typecheck`;
- shared packages:
  - `@payment-ops/tsconfig`;
  - `@payment-ops/eslint-config`;
  - `@payment-ops/shared-types`;
  - `@payment-ops/shared-config`;
  - `@payment-ops/shared-logger`;
- Docker Compose для PostgreSQL і Redis;
- `.env.example` з базовими `DATABASE_URL`, `REDIS_URL`, `LOG_LEVEL`;
- порожній `apps/`, готовий для першого сервісу.

Phase 2 має працювати поверх цієї foundation без зміни напрямку Phase 1.

## Scope

Phase 2 включає:

- створення `apps/sms-gateway`;
- NestJS HTTP API;
- Zod validation на service boundary;
- Swagger документацію для `POST /sms/send` і `GET /sms/status/:jobId`;
- Prisma schema і migration для `sms_messages`;
- BullMQ queue для асинхронної відправки SMS;
- provider abstraction і mock providers;
- country-based routing;
- fallback між providers;
- захист від подвійної відправки через idempotency key;
- optional `Fast2SmsProvider` behind env flags;
- focused unit/integration tests;
- README для сервісу.

Phase 2 не включає:

- Receipt Recognizer;
- Layout Builder;
- frontend;
- auth system;
- production observability;
- real SMS calls in tests або default demo;
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
│   ├── fixtures/
│   ├── provider-routing.spec.ts
│   ├── provider-fallback.spec.ts
│   └── sms-api.e2e-spec.ts
├── eslint.config.mjs
├── package.json
├── README.md
├── tsconfig.json
└── tsconfig.build.json
```

Якщо NestJS CLI генерує трохи іншу форму, її варто привести до цієї структури
після scaffold, а не тягнути зайву CLI-generated складність.

## API Contract

### `POST /sms/send`

Request:

```json
{
  "phoneNumber": "+919876543210",
  "message": "Your OTP is 123456",
  "idempotencyKey": "otp-login-usr_123-2026-05-13T17:30",
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

- validate body with Zod;
- accept optional `idempotencyKey` in body;
- choose initial provider synchronously before queueing;
- if `idempotencyKey` already exists, return the existing job instead of
  enqueueing a second send;
- persist `sms_messages` row with `queued` status and optional idempotency key;
- enqueue BullMQ job with `jobId`;
- return `queued` response immediately.

Duplicate handling should be local and explicit. Phase 2 does not add auth, but
clients can still prevent accidental double sends by reusing the same
`idempotencyKey` for one logical SMS operation.

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

- read canonical status from database;
- return `404` for unknown `jobId`;
- include selected/current provider, attempts, and last error.

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

Use service-local Prisma schema in `apps/sms-gateway/prisma/schema.prisma`.

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
should own this id and use it as both API id and DB primary key.

Use `idempotencyKey` to protect against accidental duplicate sends. If a repeated
request uses the same key, same phone number, and same message, return the
existing job with `deduplicated: true`. If the same key is reused with a different
phone number or message, return `409 Conflict` because the client is attempting
to reuse an idempotency key for a different logical operation.

## Queue Flow

Use BullMQ with Redis from `REDIS_URL`.

Flow:

1. `POST /sms/send` validates payload.
2. If `idempotencyKey` is present, `SmsService` checks for an existing message.
3. If an equivalent message already exists, the service returns that job without
   queueing another BullMQ job.
4. `SmsService` selects the initial provider using `ProviderRegistry`.
5. Service creates a `SmsMessage` row with `queued`.
6. Service adds a BullMQ job to `sms-send`.
7. Processor loads the message and marks it `processing`.
8. Processor calls selected provider.
9. On success, DB row becomes `sent`.
10. On provider failure, processor asks registry for the next fallback provider.
11. If fallback succeeds, DB row becomes `sent` with the fallback provider name.
12. If all providers fail, DB row becomes `failed` with `lastError`.

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
- all other numbers -> `TwilioMockProvider`.

Fallback order:

1. selected country provider;
2. `VonageMockProvider`, якщо це не selected provider;
3. `TwilioMockProvider`, якщо це не selected provider;
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

Add real adapter name: `Fast2SmsProvider`.

Activation rules:

- enabled only when `FAST2SMS_ENABLED=true`;
- requires `FAST2SMS_API_KEY`;
- otherwise the registry uses `Fast2SmsMockProvider`;
- tests and default demos must never call the real provider.

Implementation approach:

- use native `fetch` from Node runtime;
- endpoint: `POST https://www.fast2sms.com/dev/bulkV2`;
- auth header: `authorization`;
- keep the request builder isolated and covered by tests with mocked fetch;
- do not add a Fast2SMS SDK in Phase 2.

## Configuration

Service env schema should use `@payment-ops/shared-config`.

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

Update root `.env.example` only if a variable is actually consumed by the
implemented service.

## Dependencies

Expected app dependencies:

- NestJS core/platform packages;
- Swagger package for API docs;
- Zod;
- Prisma client;
- BullMQ and Nest integration for queues;
- Pino integration if needed, or direct shared logger usage;
- test runner dependencies local to the app.

Keep dependency additions service-scoped where possible. Root dev dependencies
should only receive tooling that is truly workspace-wide.

## Testing Plan

Minimum tests:

- provider routing:
  - `+380` -> `KyivstarMockProvider`;
  - `+91` -> `Fast2SmsMockProvider`;
  - `+49`, `+33`, `+44` -> `VonageMockProvider`;
  - unknown prefix -> `TwilioMockProvider`;
- fallback:
  - selected provider fails;
  - next provider succeeds;
  - DB status records fallback provider and attempt count;
- validation:
  - invalid phone number rejected;
  - empty message rejected;
- idempotency:
  - repeated same `idempotencyKey`, phone number, and message returns existing job;
  - repeated same `idempotencyKey` with different payload returns `409`;
  - duplicate request does not enqueue a second BullMQ job;
- API:
  - `POST /sms/send` returns queued job;
  - `GET /sms/status/:jobId` returns persisted status;
  - unknown `jobId` returns `404`;
- Fast2SMS:
  - disabled by default;
  - missing key falls back to mock;
  - request builder sends `authorization` header when enabled.

For e2e tests, prefer a test database schema or cleanup strategy that does not
depend on production-like infrastructure. If full Docker-backed e2e is too slow,
keep one integration test path and use unit tests for routing/fallback detail.

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
11. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
12. Verify local demo path with Docker running.

## Definition of Done

Phase 2 is done when:

- `apps/sms-gateway` starts locally with `pnpm dev`;
- `POST /sms/send` returns a queued job;
- duplicate `POST /sms/send` with the same `idempotencyKey` does not send twice;
- conflicting idempotency key reuse returns `409`;
- `GET /sms/status/:jobId` returns persisted status;
- mock providers route by country prefix;
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
