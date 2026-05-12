# Ревью підходу

Це ревью фокусується на готовності до першої фази реалізації і головних ризиках
поточної архітектури.

## Summary

Підхід сильний для test-task prototype: є чіткі service boundaries, replaceable
external-provider abstractions і demo story, яка показує архітектуру без
обов'язкових платних сервісів.

Головне покращення - зменшити scope pressure. Початковий документ змішував
архітектуру, implementation checklists, service details, fixtures, provider
notes і final instructions. Розділення цих речей робить першу фазу простішою для
реалізації та ревью.

## Сильні сторони

- Чітке prototype constraint: local-first, free by default, no required API keys.
- Хороше використання interfaces для SMS providers і receipt normalizers.
- Реалістична provider behavior model: latency, failures, fallback, status.
- Dynamic API contracts у Layout Builder - найсильніший differentiator для
  test task.
- Надані PhonePe screenshots дають реалістичні OCR fixtures замість повністю
  synthetic data.
- Gemini і Fast2SMS правильно позиціоновані як optional adapters, не default
  dependencies.

## Основні ризики

### Scope Creep

Три сервіси, frontend, queues, database, OCR, SVG rendering, dynamic API schemas
і optional external providers - це багато для одного prototype.

Рекомендація: реалізовувати вертикальними фазами і зробити SMS Gateway першим
end-to-end service після foundation. Не стартувати всі сервіси паралельно.

### Optional Providers можуть зламати free demo story

Gemini і Fast2SMS корисні, але вони відволікатимуть від головної вимоги, якщо
стануть необхідними для успішного demo.

Рекомендація: кожен optional provider має мати:

- explicit env flag;
- missing-key fallback;
- тести без network calls;
- README wording, що provider optional.

### Receipt OCR Accuracy

Tesseract на фото телефону може давати шум, особливо з glare, perspective і
малим текстом. Якщо demo залежить від ідеального extraction на найскладнішому
fixture, воно виглядатиме крихким.

Рекомендація: зробити OCR confidence частиною feature. Зберігати raw OCR text,
показувати extracted fields з confidence і дозволити RegexNormalizer частковий
success.

### Dynamic API Complexity

Randomized endpoints і randomized field mappings виглядають сильно, але їх
складно debug-ити, якщо схема стане надто dynamic надто рано.

Рекомендація: почати з deterministic seeded randomness і логувати canonical
mapping. Додати тільки три payload structures: flat, nested, key-value array.

### Shared Packages можуть стати dumping ground

Shared packages корисні, але передчасне sharing створює coupling між сервісами.

Рекомендація: у `shared-types` тримати тільки stable primitives. Service-specific
DTOs мають жити всередині сервісу, поки reuse не стане реальним.

## Рекомендовані зміни

### Phase 1 має бути тільки infrastructure

Phase 1 має створити чистий monorepo foundation і зупинитись перед business
logic. Так перший implementation commit буде легко ревʼювити, а наступні сервіси
отримають стабільну базу.

Minimum Phase 1 output:

- root workspace files;
- shared config packages;
- Docker Compose;
- `.env.example`;
- README;
- без NestJS service code.

### Phase 2 має бути SMS Gateway

SMS Gateway - найкращий перший vertical slice, бо він перевіряє:

- provider abstraction;
- country routing;
- fallback;
- queueing;
- database persistence;
- Swagger;
- tests.

Він простіший за OCR і dynamic layouts, тому краще валідовує monorepo setup без
старту з найскладнішої частини.

### Layout Builder варто залишити на пізніше

Layout Builder - найсильніша demo feature, але має найбільшу product і UI
complexity. Його краще робити після того, як backend patterns вже доведені.

Рекомендований порядок:

1. Foundation.
2. SMS Gateway.
3. Receipt Recognizer.
4. Layout Builder backend.
5. Builder frontend and polish.

### ADRs додавати після реалізованих рішень

ADR-и краще створювати, коли рішення вже стало concrete:

- monorepo tooling після Phase 1;
- provider abstraction після SMS Gateway;
- OCR strategy після Receipt Recognizer;
- dynamic contracts після Layout Builder.

## Readiness Checklist перед Phase 1

Перед кодингом Phase 1 перевірити:

- Node і pnpm version для `packageManager`;
- чи frontend пізніше буде React, чи бажано Vanilla TS;
- Docker доступний локально;
- repository name стабільний: `payment-ops-prototype-lab`;
- GitHub authentication виправлений перед наступним push.

## Verdict

Можна переходити до Phase 1, але тримати її навмисно вузькою. Prototype виглядає
сильніше, коли foundation нудний, надійний і легко запускається, а складні
частини додаються clean vertical slices, а не всі одночасно.
