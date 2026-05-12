# Контекст проєкту

Я роблю тестове завдання — прототип монорепо з трьома мікросервісами на NestJS. 
Це **локальний прототип**, не production. Мета — продемонструвати архітектурне мислення, 
розуміння монорепо, NestJS, динамічних API-контрактів та інтеграцій.

**КРИТИЧНА ВИМОГА:** базовий demo path використовує тільки локальні безкоштовні
інструменти або симуляцію платних сервісів. Жодних обов'язкових API-ключів до
Anthropic/OpenAI/Twilio/тощо. Все має працювати offline на локальній машині без
зовнішніх платних залежностей.

**Дозволений optional free-tier:** Gemini API free tier можна використати як
опційний provider для покращення нормалізації чеків, але тільки за явним env flag
і наявності `GEMINI_API_KEY`. Без ключа або при rate-limit/error сервіс має
автоматично повертатися до локального `RegexNormalizer`.

## Технічний стек (фіксований)

- **Monorepo:** Turborepo + pnpm workspaces
- **Backend:** NestJS (TypeScript) для всіх трьох сервісів
- **DB:** PostgreSQL (через Prisma ORM)
- **Queue:** Redis + BullMQ (де треба асинхронність)
- **Validation:** Zod (DTO + runtime schema validation)
- **OCR:** Tesseract.js (повністю локальний, безкоштовний)
- **Color extraction:** node-vibrant
- **Frontend (тільки для Layout Builder):** Vite + Vanilla TS / React 
  без UI бібліотек, чистий fetch для видимості в Network
- **Containerization:** Docker + docker-compose
- **API docs:** Swagger (NestJS вбудований)

## Структура монорепо

```
platform/
├── apps/
│   ├── sms-gateway/          # NestJS — мульти-країна SMS (mock providers)
│   ├── receipt-recognizer/   # NestJS — OCR через Tesseract + simulated AI
│   ├── layout-builder/       # NestJS — генератор лейаутів з динамічним API
│   └── builder-frontend/     # Vite SPA — UI для layout-builder
├── packages/
│   ├── shared-types/
│   ├── shared-config/
│   ├── shared-logger/
│   ├── eslint-config/
│   └── tsconfig/
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

---

# Опис сервісів

## 1️⃣ SMS Gateway

**Призначення:** відправка SMS у різні країни з автоматичним вибором провайдера.
**Всі провайдери за замовчуванням — моки.** Це не обмеження, а архітектурний вибір для прототипу.
Для Fast2SMS можна додати опційний real-adapter, але він має бути вимкнений без API key,
щоб локальний демо-сценарій залишався безкоштовним і придатним для offline запуску.

**Вимоги:**
- Endpoint `POST /sms/send` приймає `{ phoneNumber, message, metadata? }`
- Country routing: визначення країни по префіксу номера (E.164)
- Strategy pattern: інтерфейс `ISmsProvider` з методами `send()`, `getStatus()`
- Мінімум 4 mock-реалізації (іменовані як реальні провайдери для реалістичності):
  - **TwilioMockProvider** — симулює відправку, latency 100-300ms, успіх 95%
  - **VonageMockProvider** — симулює відправку, latency 150-400ms, успіх 90%
  - **KyivstarMockProvider** — для UA номерів, latency 50-200ms, успіх 98%
  - **Fast2SmsMockProvider** — для IN номерів, latency 120-350ms, успіх 93%
- Опційний real adapter:
  - **Fast2SmsProvider** — реальний adapter під інтерфейс `ISmsProvider`, але тільки якщо
    `FAST2SMS_ENABLED=true` і є `FAST2SMS_API_KEY`.
  - Якщо ключа немає, provider не падає на старті сервісу, а selector повертає mock.
  - API contract Fast2SMS: `POST https://www.fast2sms.com/dev/bulkV2`,
    `authorization` header, route `dlt`, `dlt_manual`, `otp` або `q`.
  - Для прототипу використовувати route `q` або `otp` тільки як задокументовану можливість;
    реальні запити не виконувати в тестах і demo без явного env flag.
- Country routing logic:
  - `+380` → KyivstarMockProvider
  - `+91` → Fast2SmsMockProvider
  - `+49`, `+33`, `+44` → VonageMockProvider
  - решта → TwilioMockProvider
- Fallback: якщо провайдер фейлиться → пробуємо наступний у ланцюжку
- Симуляція реальної поведінки: random delay, random failure (configurable rates)
- Асинхронна черга через BullMQ
- Endpoint `GET /sms/status/:jobId` повертає статус
- Збереження в Postgres: таблиця `sms_messages`

**Демо в README:** curl приклади UA/IN/DE/US номерів.

---

## 2️⃣ Receipt Recognizer

**Призначення:** розпізнавання банківських чеків зі скріншотів.
**Використовуємо Tesseract.js (безкоштовно) + локальний normalizer.**
Опційно можна підключити Gemini API free tier для AI-нормалізації OCR text.

### Архітектура

```
Upload → multer → Tesseract.js (OCR) → Normalizer → Zod validate → DB
```

### Normalizer strategy

Створи інтерфейс `IReceiptNormalizer`:
```typescript
interface IReceiptNormalizer {
  normalize(rawText: string): Promise<ReceiptData>;
}
```

Реалізації:
- **RegexNormalizer** (default) — парсить OCR text через regex patterns 
  для типових форматів (ПриватБанк, Monobank, Revolut). Імітує "AI" затримку 
  через `setTimeout(800-1500ms)` щоб виглядало реалістично в UI.
- **GeminiNormalizer** (optional free-tier) — використовує Gemini API для
  структурування OCR text у `ReceiptData`. Активується тільки через
  `NORMALIZER=gemini`, `GEMINI_ENABLED=true` і `GEMINI_API_KEY`.
  Якщо ключ відсутній, quota/rate limit вичерпано або API недоступний,
  normalizer логить причину і робить graceful fallback на `RegexNormalizer`.
  Рекомендована модель для прототипу: `gemini-2.5-flash-lite` або актуальна
  free-tier Flash/Flash-Lite модель з Google AI Studio.
  Важливо: free-tier usage може використовуватися Google для покращення
  продуктів, тому не відправляти PII у demo без маскування.
- **AnthropicNormalizer** (placeholder) — клас існує, ловить відсутність 
  API key і кидає зрозумілий error: "Anthropic provider requires API key. 
  Using RegexNormalizer instead." Це показує **архітектурну готовність** 
  до підключення реального LLM без витрат на тестове.

**Перемикання через env:** `NORMALIZER=regex` (default), `NORMALIZER=gemini`
або `NORMALIZER=anthropic`.

### Endpoints
- `POST /receipts/upload` (multipart) — приймає зображення, повертає `receiptId`
- `GET /receipts/:id` — результат розпізнавання
- `GET /receipts/:id/raw` — сирий OCR text (для дебагу)

### Результат
```typescript
{
  bank: string | null,
  transactionDate: string | null,
  amount: number | null,
  currency: string | null,
  sender: string | null,
  recipient: string | null,
  transactionId: string | null,
  confidence: number,  // 0-1, базується на повноті заповнення полів
  rawText: string,
  normalizedBy: 'regex' | 'anthropic'
}
```

### Тестові дані
- Покласти надані справжні скріншоти чеків PhonePe у
  `apps/receipt-recognizer/test-fixtures/phonepe/`.
- Мінімальний набір fixtures:
  - `phonepe-axis-bank-10000.jpg` — clean screenshot, сума `₹10,000`, recipient `Ansh Anand`,
    transaction id `T21474836471229701068`, UTR `429948609046`.
  - `phonepe-yes-bank-25618.jpg` — фото екрана, сума `₹25,618`, recipient
    `Jay Prakash Kumar`, transaction id `T2604170007543077317626`, UTR `996178679704`.
  - `phonepe-icici-bank-13000.jpg` — фото екрана під кутом, сума `₹13,000`,
    recipient `VISHAL`, transaction id `T3748004208605153848062`, UTR `423152720207`.
- RegexNormalizer має підтримати PhonePe receipt patterns:
  `Transaction Successful`, `Paid to`, `Banking Name`, `Transaction ID`,
  `Debited from`, `UTR`, суми у INR з символом `₹`.
- Dummy скріни через Puppeteer залишаються optional fallback тільки якщо реальні fixtures
  відсутні.

---

## 3️⃣ Layout Builder (найскладніший)

**Призначення:** генерація брендованих лейаутів з ДИНАМІЧНОЮ API-схемою.
**Все локально, без зовнішніх API.**

### Концепція

При створенні нового бренду:
1. Бекенд приймає лого + назву
2. Витягує палітру кольорів з лого (node-vibrant)
3. Генерує **унікальну API-схему** для цього бренду:
   - рандомний slug для endpoint
   - рандомні імена полів у 3 стилях (camelCase / snake_case / kebab-case)
   - варіативна структура (flat / nested / array-of-pairs)
4. Зберігає мапінг канонічних полів → рандомних
5. Повертає схему фронтенду
6. Фронтенд робить серію запитів за цією схемою → у Network видно кожен раз різні endpoints і поля

### Endpoints

**Статичні:**
- `POST /brands` (multipart: logo + name) → `{ brandId, palette, apiSchema }`
- `GET /brands/:id/schema` — повторно отримати схему
- `GET /brands/:id/layout` — фінальний SVG/PNG

**Динамічні (per-brand):**
- `POST /brands/:id/{randomEndpointSlug}` — приймає бренд-дані за схемою
- Поля декодуються через мапінг → канонічні → Zod validation

### Приклади згенерованих схем

```typescript
// Brand A — snake_case + flat
{
  endpoint: "/brands/br_abc123/configure_x9k2",
  method: "POST",
  fieldsStyle: "snake_case",
  structure: "flat",
  fields: {
    title: "company_title_8fa",
    primaryColor: "primary_color_2x",
    layoutVariant: "variant_q3"
  }
}

// Brand B — camelCase + nested
{
  endpoint: "/brands/br_xyz789/setupBrand_m4P2",
  method: "POST",
  fieldsStyle: "camelCase",
  structure: "nested",
  fields: {
    title: "brand.name",
    primaryColor: "brand.palette.primary",
    layoutVariant: "settings.variant"
  }
}

// Brand C — kebab-case + key-value array
{
  endpoint: "/brands/br_qwe456/init-brand-7Hk",
  method: "POST",
  fieldsStyle: "kebab-case",
  structure: "key-value-array",
  fields: { title: "brand-title", primaryColor: "primary-color" }
  // payload: [{ key: "brand-title", value: "Acme" }, ...]
}
```

### Color extraction
- `node-vibrant` (повністю локально, безкоштовно)
- 6 семантичних кольорів: Vibrant, Muted, DarkVibrant, LightVibrant, DarkMuted, LightMuted

### Layout generation
- 3 SVG шаблони у `apps/layout-builder/src/templates/`
- Seeded random через `seedrandom`, seed = brandId
- Унікальні елементи: SVG blob-shapes, patterns, typography variations
- Output: SVG string (швидко, без браузера)
- Опційний бонус: PNG через Puppeteer (теж безкоштовно, локально)

### Layout reference
- Останній наданий скрін — референс для фінального layout preview:
  payment operations dashboard у стилі KOI.
- Обов'язкові елементи layout:
  - top bar з logo/name, перемикачем `P2P / INTENT`, датою і user icon;
  - заголовок `Payments` + balance badge;
  - search by transaction id;
  - filters: payment method, payment type, status, date from, date to;
  - actions: page size select, `Payments Report (Support)`,
    `Finance Report (Reconciliation)`, `Refresh`;
  - таблиця payments з колонками `Transaction ID`, `Status`, `Requested amount`,
    `Paid amount`, `Created`, `Paid`, `Type`, `Method`;
  - статуси як compact badges, copy icon біля transaction id, sticky/scrollable table body.
- Один із 3 SVG шаблонів має бути dashboard/table variant, щоб брендований лейаут
  відображав не абстрактний банер, а реальний payment operations screen.

### Frontend (`builder-frontend`)

Мінімальна Vite SPA:
1. Форма: upload logo + input name + кнопка "Generate Brand"
2. Після створення — серія fetch за динамічною схемою (видно в Network)
3. Відображає лейаут + палітру
4. Без UI бібліотек, чистий CSS

### Persistence

Postgres:
- `brands` (id, name, logo_path, palette JSON, created_at)
- `brand_schemas` (brand_id, schema JSON, field_mapping JSON)
- `brand_requests` (brand_id, payload JSON, endpoint_used, created_at)

---

# Покроковий план реалізації

Виконуй **строго по кроках**. Після кожного зупиняйся і повідомляй: 
"✅ Крок X завершено, готовий до кроку X+1". Я перевірю і дам go.

## Крок 1: Фундамент монорепо
- [ ] Структура папок `apps/`, `packages/`
- [ ] `pnpm-workspace.yaml`
- [ ] `turbo.json` з pipeline: `build`, `dev`, `lint`, `test`
- [ ] `packages/tsconfig/` — базові tsconfig
- [ ] `packages/eslint-config/`
- [ ] Кореневий `package.json` зі скриптами

## Крок 2: Shared packages
- [ ] `packages/shared-types` — спільні interfaces/DTOs
- [ ] `packages/shared-config` — Zod env validation wrapper
- [ ] `packages/shared-logger` — Pino setup

## Крок 3: Docker інфраструктура
- [ ] `docker-compose.yml`: postgres + redis з healthchecks
- [ ] `.env.example`
- [ ] Скрипт `pnpm docker:up`

## Крок 4: SMS Gateway скелет
- [ ] NestJS init у `apps/sms-gateway/`
- [ ] Prisma setup + міграція `sms_messages`
- [ ] Module structure: `sms/`, `providers/`, `queue/`
- [ ] Swagger
- [ ] Health endpoint

## Крок 5: SMS Gateway логіка
- [ ] `ISmsProvider` інтерфейс
- [ ] 4 mock провайдери з конфігурованими success rate / latency
- [ ] Fast2SMS mock для `+91` номерів
- [ ] Optional `Fast2SmsProvider` real adapter behind `FAST2SMS_ENABLED=true`
- [ ] CountryRouter (E.164)
- [ ] Fallback chain
- [ ] BullMQ queue + worker
- [ ] Endpoints `POST /sms/send`, `GET /sms/status/:jobId`
- [ ] 2 юніт-тести: routing + fallback
- [ ] README з curl для UA/IN/DE/US

## Крок 6: Receipt Recognizer скелет
- [ ] NestJS init
- [ ] Prisma міграція `receipts`
- [ ] Multer для upload
- [ ] Swagger

## Крок 7: Receipt Recognizer логіка
- [ ] Tesseract.js інтеграція
- [ ] `IReceiptNormalizer` інтерфейс
- [ ] `RegexNormalizer` з парсингом PhonePe + 2-3 форматів банків
- [ ] `GeminiNormalizer` optional adapter для Gemini API free tier
- [ ] `AnthropicNormalizer` placeholder з graceful fallback
- [ ] Selector через env `NORMALIZER`
- [ ] Fallback chain: Gemini/Anthropic errors → RegexNormalizer
- [ ] Zod schema відповіді
- [ ] Endpoints `POST /receipts/upload`, `GET /receipts/:id`, `GET /receipts/:id/raw`
- [ ] 1 тест на normalizer logic
- [ ] Fixtures з наданими PhonePe скрінами
- [ ] README з curl

## Крок 8: Layout Builder скелет
- [ ] NestJS init
- [ ] Prisma міграції `brands`, `brand_schemas`, `brand_requests`
- [ ] Multer для лого
- [ ] Структура: `brands/`, `schema-generator/`, `layout-renderer/`, `dynamic-router/`

## Крок 9: Layout Builder — color + schema
- [ ] Color extraction через node-vibrant
- [ ] `SchemaGeneratorService`:
  - random endpoint slug
  - random field names у 3 стилях
  - 3 варіанти структури
- [ ] Мапінг у БД
- [ ] `POST /brands` → brandId + palette + schema

## Крок 10: Layout Builder — динамічний роутинг
- [ ] Dynamic controller `/brands/:id/:slug`
- [ ] Middleware декодування через field_mapping
- [ ] Валідація канонічних полів (Zod)
- [ ] Збереження в `brand_requests`

## Крок 11: Layout Builder — рендер
- [ ] 3 SVG шаблони з seeded random
- [ ] Dashboard/table template за референсом останнього скріну
- [ ] Унікальні blob shapes / patterns
- [ ] `GET /brands/:id/layout` → SVG
- [ ] (Опційно) PNG через Puppeteer

## Крок 12: Frontend для Builder
- [ ] Vite + TS init
- [ ] Форма upload + name
- [ ] Серія fetch за динамічною схемою
- [ ] Відображення лейаута + палітри
- [ ] CORS налаштування

## Крок 13: Polish
- [ ] Кореневий README:
  - архітектурна діаграма (Mermaid)
  - інструкції запуску (`pnpm install && pnpm docker:up && pnpm dev`)
  - демо-сценарії
  - архітектурні рішення
  - **окремий розділ "Why free-tier prototyping?"** — пояснення вибору 
    Tesseract замість Cloud Vision, моків замість Twilio. Покажи що це 
    усвідомлений вибір, не обмеження.
- [ ] ADR файли у `docs/adr/`:
  - 0001-monorepo-tooling.md
  - 0002-ocr-strategy.md
  - 0003-dynamic-api-contracts.md
  - 0004-provider-abstraction.md
- [ ] `pnpm demo` скрипт

---

# Конвенції коду

- **TypeScript strict mode** скрізь
- **NestJS DI** — без singletons зовні модулів
- **DTO + Zod** для всіх вхідних даних
- **Іменування:** PascalCase для класів, camelCase для змінних, kebab-case для файлів
- **Структура модуля NestJS:** `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `entities/`
- **Коментарі тільки де неочевидна логіка**
- **Async/await** замість Promise chains
- **Error handling:** кастомні exceptions через NestJS exception filters
- **Інтерфейси для зовнішніх інтеграцій** — щоб mock/real реалізації були взаємозамінні

# Що НЕ робити

- ❌ Auth систему (заглушка `X-API-Key` хедер максимум)
- ❌ Production logging stack
- ❌ Kubernetes, CI/CD, моніторинг
- ❌ Великі тестові покриття — 1-2 значущих тести на сервіс
- ❌ UI бібліотеки на фронті
- ❌ Обов'язкові реальні API ключі — все локально/моки by default
- ❌ Платні сервіси будь-якого вигляду

# Філософія прототипу

Цей код демонструє **архітектурне мислення**, а не реальну продакшн інтеграцію.
Кожен mock/симулятор має чіткий інтерфейс, щоб реальну реалізацію можна було
підключити без зміни решти коду. Це і є показник якості — **готовність до 
масштабування без переписування**.

# Старт

Почни з **Кроку 1**. Видай повну файлову структуру з вмістом усіх конфіг-файлів. 
Після завершення Кроку 1 — зупинись і чекай моєї команди для Кроку 2.
