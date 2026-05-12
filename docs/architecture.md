# Архітектура проєкту

`payment-ops-prototype-lab` - локальний прототип монорепо з трьома NestJS
сервісами. Мета - показати архітектурне мислення навколо provider abstractions,
OCR-нормалізації, динамічних API-контрактів, черг, persistence і невеликого
frontend demo.

Це не production-система. Базовий demo path має працювати локально без платних
сервісів і без обов'язкових зовнішніх API-ключів.

## Основні обмеження

- Базове demo використовує локальні інструменти, моки або симулятори.
- Немає обов'язкових API-ключів для Anthropic, OpenAI, Twilio, Fast2SMS,
  Gemini або інших зовнішніх provider-ів.
- Optional free-tier інтеграції дозволені тільки за явними env flags.
- Якщо optional provider падає, вичерпує quota або не має ключа, сервіс має
  повернутися до локальної реалізації.
- Реалізація має робити акцент на зрозумілих інтерфейсах і replaceable adapters,
  а не на production-інфраструктурі.

## Технічний стек

- Monorepo: Turborepo + pnpm workspaces
- Backend: NestJS + TypeScript strict mode
- Database: PostgreSQL через Prisma
- Queue: Redis + BullMQ там, де async flow справді корисний
- Validation: Zod для DTO/runtime validation
- OCR: Tesseract.js
- Color extraction: node-vibrant
- Frontend: Vite з plain TypeScript або React, без UI component library
- Containerization: Docker Compose
- API docs: Swagger

## Цільова структура репозиторію

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

## Сервіси

### SMS Gateway

Призначення: відправка SMS через country-based provider routing.

Default providers - моки:

- `KyivstarMockProvider` для `+380`
- `Fast2SmsMockProvider` для `+91`
- `VonageMockProvider` для `+49`, `+33`, `+44`
- `TwilioMockProvider` як default fallback

Optional real adapter:

- `Fast2SmsProvider`, увімкнений тільки з `FAST2SMS_ENABLED=true` і
  `FAST2SMS_API_KEY`.
- Adapter використовує Fast2SMS `POST https://www.fast2sms.com/dev/bulkV2` з
  `authorization` header.
- Тести і default demos ніколи не мають викликати реальний provider.

Основні API:

- `POST /sms/send`
- `GET /sms/status/:jobId`

Persistence:

- `sms_messages`

### Receipt Recognizer

Призначення: upload скріншотів чеків, OCR, нормалізація тексту в структуровані
payment data і збереження результату.

Pipeline:

```text
Upload -> multer -> Tesseract.js -> Normalizer -> Zod validation -> DB
```

Normalizer strategy:

- `RegexNormalizer` - default offline implementation.
- `GeminiNormalizer` - optional free-tier support behind `NORMALIZER=gemini`,
  `GEMINI_ENABLED=true` і `GEMINI_API_KEY`.
- `AnthropicNormalizer` - placeholder, який показує readiness до provider-а, але
  має graceful fallback без API key.

Privacy rule: free-tier LLM usage може використовуватись provider-ом для
покращення продуктів. Не відправляти реальний PII у demo без маскування.

Основні API:

- `POST /receipts/upload`
- `GET /receipts/:id`
- `GET /receipts/:id/raw`

Persistence:

- `receipts`

Fixtures:

- Надані PhonePe screenshots зберігати в
  `apps/receipt-recognizer/test-fixtures/phonepe/`.
- Regex parser має підтримувати `Transaction Successful`, `Paid to`,
  `Banking Name`, `Transaction ID`, `Debited from`, `UTR` і INR amounts.

### Layout Builder

Призначення: генерація брендованих лейаутів з dynamic per-brand API contract.

Flow:

1. Upload logo і brand name.
2. Extract palette через `node-vibrant`.
3. Generate унікальний endpoint slug і randomized field names.
4. Store canonical field mapping.
5. Accept brand configuration через dynamic endpoint.
6. Render final SVG layout.

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

- Один template має повторювати логіку наданого KOI-style payments dashboard:
  top bar, balance badge, filters, report actions, refresh action і scrollable
  payments table.

## Фази реалізації

### Phase 1: Foundation

Створити foundation монорепо, shared packages, Docker infrastructure і чіткий
README. У цій фазі не реалізовуємо business logic.

Детальний план: [implementation.md](./implementation.md).
Детальні вимоги до сервісів: [service-requirements.md](./service-requirements.md).

### Phase 2: SMS Gateway

Перший end-to-end backend service: providers, routing, queue, database, Swagger
і focused tests.

### Phase 3: Receipt Recognizer

Upload, OCR, normalizer strategy, fixtures і fallback behavior.

### Phase 4: Layout Builder

Brand creation, palette extraction, dynamic schema generation, dynamic route
decoding і SVG rendering.

### Phase 5: Frontend and Demo Polish

Vite demo UI, root README demo scripts, ADRs і final walkthrough.

## Non-Goals

- Auth system за межами простого optional `X-API-Key` demo guard.
- Production logging, metrics, tracing або monitoring stack.
- Kubernetes, CI/CD або cloud deployment.
- Велике test coverage. Кожному сервісу потрібні кілька змістовних тестів, не
  production test suite.
- Required real API keys.
- Paid services.

## Інженерні принципи

- Prefer replaceable interfaces для кожної external integration.
- Моки мають бути достатньо реалістичними: latency, failure, fallback, status
  polling.
- Local startup має бути простим: `pnpm install`, `pnpm docker:up`, `pnpm dev`.
- Use Zod at service boundaries.
- Use Prisma migrations for durable state.
- Frontend має бути мінімальним, але корисним для перевірки network behavior.

Дивись також: [review.md](./review.md).
