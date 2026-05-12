# План реалізації

Цей документ готує першу фазу реалізації. Ціль - почати з чистого monorepo
foundation, який зможе підтримати всі три сервіси без передчасних рішень по
business logic.

## Scope Phase 1

Phase 1 включає:

- workspace structure;
- root package scripts;
- shared TypeScript та ESLint setup;
- базові shared packages;
- Docker Compose для PostgreSQL і Redis;
- `.env.example`;
- root README з інструкціями запуску і коротким описом проєкту.

Phase 1 не включає:

- NestJS service implementation;
- Prisma models для domain tables;
- queue workers;
- OCR;
- provider logic;
- frontend UI.

## Deliverables Phase 1

```text
apps/
packages/
├── shared-config/
├── shared-logger/
├── shared-types/
├── eslint-config/
└── tsconfig/
docs/
docker-compose.yml
.env.example
.gitignore
package.json
pnpm-workspace.yaml
turbo.json
README.md
```

## Root Package Scripts

Root `package.json` має містити:

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:logs": "docker compose logs -f"
  }
}
```

Використати `"packageManager": "pnpm@10.32.1"`, якщо локальне середовище вже на
цій версії. Якщо ні - зафіксувати версію, яку реально активує Corepack.

## Workspace Rules

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`turbo.json` має визначати `build`, `dev`, `lint`, `test` і `typecheck`.
У першій фазі tasks можуть бути простими, бо більшість packages ще міститимуть
тільки config/type scaffolding.

## Shared Packages

### `packages/tsconfig`

Reusable TypeScript configs:

- `base.json` для strict shared defaults;
- `nestjs.json` extending base для backend services;
- `vite.json` extending base для frontend.

Рекомендовані defaults:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `moduleResolution: "Bundler"` там, де це доречно для конкретного app config
- declaration output для shared packages

### `packages/eslint-config`

У Phase 1 тримати lightweight. Не варто інвестувати в складний lint setup до
появи apps.

Minimum export:

- TypeScript parser і recommended rules;
- без formatting rules, які конфліктують з Prettier, якщо Prettier не є
  свідомо відкинутим рішенням;
- один shared config file для future packages.

### `packages/shared-types`

Почати тільки зі стабільних cross-service primitives:

- `HealthResponse`;
- `ProviderStatus`;
- `MoneyAmount`;
- placeholder DTO exports, згруповані по service namespace.

Не складати сюди service internals. Якщо type використовується лише одним
сервісом, він має жити в цьому сервісі.

### `packages/shared-config`

Малий Zod-based helper:

- `createEnvSchema`;
- `parseEnv`;
- typed error formatting для missing/invalid env vars.

Не централізувати всі service env vars одразу. Кожен сервіс може володіти своєю
schema і перевикористовувати helper.

### `packages/shared-logger`

Простий Pino factory:

- приймає `serviceName`;
- читає `LOG_LEVEL`;
- дає human-readable logs у local dev, якщо це практично;
- не додає production logging infrastructure.

## Docker Compose

Phase 1 має дати:

- `postgres` service;
- `redis` service;
- health checks;
- named volumes;
- stable local ports.

Рекомендовані defaults:

```text
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=payment_ops
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/payment_ops?schema=public
REDIS_URL=redis://localhost:6379
```

## README Requirements

Root README має містити:

- project name і short purpose;
- local prerequisites;
- install/start commands;
- service list;
- free-tier/offline design note;
- current phase status;
- links to docs.

Не потрібно детально документувати service APIs у Phase 1. Service README можна
створювати тоді, коли відповідний service реально з'являється.

## Definition of Done Phase 1

Phase 1 завершена, коли:

- `pnpm install` проходить;
- `pnpm lint` має реальний command path, навіть якщо коду ще мало;
- `pnpm typecheck` має реальний command path;
- `pnpm docker:up` стартує PostgreSQL і Redis;
- repository structure відповідає погодженій monorepo shape;
- README пояснює, як запустити local foundation;
- жоден service не вимагає external API key.

## First Implementation Order

1. Створити root workspace files: `package.json`, `pnpm-workspace.yaml`,
   `turbo.json`, `.gitignore`.
2. Створити shared config packages.
3. Додати Docker Compose і `.env.example`.
4. Додати README.
5. Запустити install/typecheck/lint, де це можливо.
6. Закомітити Phase 1 як окрему зміну.

## Рішення, які варто стабілізувати

- Один PostgreSQL instance для всіх сервісів у prototype.
- Один Redis instance для queues.
- Package-local scripts, щоб Turborepo залишався простим.
- Не створювати generated NestJS apps до старту Phase 2.
- Не додавати Gemini, Fast2SMS або інші provider SDKs у Phase 1.
