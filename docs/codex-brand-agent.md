# Codex Brand Agent Flow

Use this flow when a Codex agent is asked to create a new payment brand.

Codex should not invent internal Layout Builder or Payment Core contracts from
memory. It must ask the running Layout Builder service for the current machine
contract, generate only a brand intent, then let the backend compile and store
the private BFF dictionary.

## Agent Steps

1. Read this file and `docs/ai-brand-generation.md`.
2. Fetch the live manifest:

   ```bash
   curl http://localhost:3003/ai-agent/brand-intent-manifest
   ```

3. Ask the user for any missing fields listed in `codexPrompt.userQuestions`.
   At minimum clarify audience, visual direction, payment metaphor, layout
   direction, and forbidden public words.
4. Generate JSON matching `BrandGenerationIntent`.
5. Keep internal words out of the generated intent: `brandId`, `payment-core`,
   `bff`, `runtime`, `rest-api`, `profile`, canonical DTO names, database names,
   and canonical public route names such as `payments`, `customers`,
   `balances`, `account`, and `metrics`.
6. Submit the intent to Layout Builder:

   ```bash
   curl -X POST http://localhost:3003/brands/intent-drafts \
     -H "content-type: application/json" \
     -d @brand-intent-request.json
   ```

7. If the draft is invalid, revise the intent using the returned validation
   issues. Do not patch hidden BFF config manually.
8. Create the brand only after the draft is valid:

   ```bash
   curl -X POST http://localhost:3003/brands/intent-drafts/YOUR_DRAFT_ID/create \
     -F logo=@/path/to/logo.svg
   ```

## Responsibility Split

- Codex/LLM generates concept, naming vocabulary, visual direction, copy, and
  status vocabulary.
- Layout Builder compiles that intent into routes, request keys, response keys,
  field aliases, status aliases, UI tokens, and contract controls.
- BFF stores the private dictionary as `generationProfile.dictionary` and uses
  contract versions to translate public brand payloads to canonical payment
  operations.
- Brand Runtime clients receive only public routes, labels, aliases, and UI
  tokens needed to render and call the brand app.
- The brand-facing prototype currently targets one page:
  `/:brandSlug/app/payments`. It should render seeded payment activity without
  requiring the user to open dashboard, customer, or balance screens.

## Uniqueness Requirements

Every generated brand should vary more than display text. Vary the payment
metaphor, auth metaphor, preferred terms, route family, field style, payload
structure, response envelope, status vocabulary, dashboard composition,
navigation pattern, visual tokens, and copy tone where the brief allows.
For the single payments page, also vary the payment activity geometry: ledger,
split workspace, terminal stream, card wall, command board, metric grouping,
status treatment, density, and typography.
