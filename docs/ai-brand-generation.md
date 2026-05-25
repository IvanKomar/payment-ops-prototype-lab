# AI Brand Generation

The main prototype flow now assumes the AI work happens in an external chat:
ChatGPT, Codex, Gemini, Claude Code, or a similar tool. The chat should not
generate the full backend contract. It should generate a compact
`BrandGenerationIntent`; Layout Builder compiles that intent into the hidden
runtime contract, BFF mapping, public brand routes, field aliases, status names,
and UI presentation.

The older full-spec and provider-backed endpoints still exist as technical
fallbacks, but they are not the primary product flow.

When Codex is the external agent, use
[`docs/codex-brand-agent.md`](./codex-brand-agent.md) as the repository-local
playbook. Codex should fetch the live manifest before generating JSON.

## Prerequisites

Start the brand runtime stack from the repository root:

```bash
pnpm run up:brand-runtime
```

This starts:

- Builder Frontend: `http://localhost:3004`
- Layout Builder API: `http://localhost:3003`
- Payment Core: `http://localhost:3005`
- Brand Runtime: `http://localhost:3006`

No OpenAI or Gemini key is required for the main flow because the external chat
produces JSON outside the app.

## Flow 1: External Chat + Admin UI

1. Ask the external chat to create a brand intent. Use the manifest endpoint for
   the exact schema and rules:

   ```bash
   curl http://localhost:3003/ai-agent/brand-intent-manifest
   ```

2. Open Builder Frontend:

   `http://localhost:3004/#layouts`

3. Go to `Layout Builder`.

4. Click `Create AI brand`.

5. Paste the JSON intent from the chat into `Brand intent JSON`.

6. Click `Compile preview`.

7. If validation passes, click `Create brand`.

After creation, the brand appears in the brand list. The admin preview renders
the generated brand runtime, and `Open user app` opens the standalone
brand-facing application on the Brand Runtime service. New AI-created brands
seed demo merchant data automatically. The current runtime target is intentionally
simple: one `payments` page that opens seeded payment activity directly. Login,
dashboard, customer, and balance screens are no longer required for the local
prototype path.

The compiler normalizes free-form visual wishes into readable payment-platform
UI tokens: light working surfaces, accessible contrast, restrained accent
colors, tabular financial typography, predictable navigation, and clear form
states. It also builds a private BFF dictionary from the compiled spec. That
dictionary is stored as `generationProfile.dictionary` and includes public
routes, request keys, response keys, field aliases, status aliases, action
labels, visual tokens, and contract controls. Brand Runtime clients receive only
the public aliases and UI data needed to render the app; canonical payment
operations remain server-side.

## Flow 2: External Chat + HTTP

Agents can use only HTTP endpoints:

```bash
curl http://localhost:3003/ai-agent/brand-intent-manifest
```

Create a compiled draft:

```bash
curl -X POST http://localhost:3003/brands/intent-drafts \
  -H "content-type: application/json" \
  -d @brand-intent-request.json
```

`brand-intent-request.json` shape:

```json
{
  "source": "codex",
  "adminPrompt": "External chat generated this brand intent.",
  "controls": {
    "payloadStructure": "nested",
    "fieldStyle": "snake_case",
    "authShape": "workspace",
    "responseEnvelope": "resource_key",
    "routeNaming": "finance",
    "errorStyle": "branded",
    "namingIntensity": "maximum"
  },
  "intent": {
    "brandName": "Copper Harbor",
    "concept": {
      "domain": "merchant acquiring for regional commerce teams",
      "audience": "market operators",
      "productMetaphor": "harbor control",
      "authMetaphor": "dock pass",
      "paymentMetaphor": "cargo clearing",
      "tone": "practical port-operations finance language",
      "avoidWords": ["stripe", "payment-core", "bff", "runtime", "profile"],
      "preferredTerms": ["harbor", "dock", "cargo", "operator", "berth", "tide"]
    },
    "namingRules": {
      "routeStyle": "short operational harbor terms without generic payment words",
      "fieldStyle": "snake_case",
      "forbiddenCanonicalNames": ["payments", "customers", "balances", "account", "metrics", "profile"],
      "examples": ["cargo-ledger", "dock-pass", "tide-stream", "operator-book"]
    },
    "uiDirection": {
      "layout": "split-workspace",
      "density": "balanced",
      "navigation": "command-rail",
      "visualStyle": "split harbor operations workspace with muted copper surfaces, steel borders, and tide-blue action states",
      "palette": ["copper", "steel", "tide blue", "white"],
      "dashboardBlocks": ["metrics", "recentPayments", "balances", "createPayment"]
    },
    "copy": {
      "loginTitle": "Enter dock",
      "registerTitle": "Issue dock pass",
      "emptyStates": {
        "payments": "No cargo clearings have been logged.",
        "customers": "No operators are in the harbor book.",
        "balances": "No tide stream movements are posted."
      },
      "actionLabels": {
        "createPayment": "Clear cargo",
        "history": "Cargo ledger",
        "refund": "Reverse cargo",
        "overview": "Harbor board",
        "payments": "Cargo clearings",
        "customers": "Operator book",
        "balances": "Tide stream"
      }
    }
  }
}
```

If the draft response has `"status": "valid"`, create the brand:

```bash
curl -X POST http://localhost:3003/brands/intent-drafts/YOUR_DRAFT_ID/create \
  -F logo=@/path/to/logo.svg
```

Direct create is also available:

```bash
curl -X POST http://localhost:3003/brands/from-intent/create \
  -F 'payload=<brand-intent-request.json;type=application/json' \
  -F logo=@/path/to/logo.svg
```

## What the Chat Should Know

The external chat should know only the intent schema and high-level product
goal:

- create a unique merchant payment gateway brand;
- render a single seeded payments page for the brand-facing app;
- still describe auth, account, balances, customers, payment methods, payment
  history, and payment creation vocabulary so the private dictionary can map
  BFF data consistently;
- avoid internal names such as `brandId`, `payment-core`, `bff`, `runtime`,
  `profile`, DTO names, database names, and canonical entity names;
- focus on product metaphor, route naming restrictions, field naming style,
  visual direction, copy, and payment status vocabulary.

The chat should not generate final endpoint paths or internal integration
contracts. The backend compiler owns those details.

## Runtime Expectations

Generated brands open as:

```text
http://localhost:3006/:brandSlug/app/payments
```

Browser-visible API calls should use only generated brand routes, for example:

```text
/:brandSlug/dock-pass
/:brandSlug/harbor-pulse
/:brandSlug/cargo-ledger
/:brandSlug/operator-book
```

The browser should not show:

- `brandId`
- `/bff`
- `/runtime`
- `/profile`
- `/rest-api`
- canonical entity names when the intent compiles to different route slugs

The BFF layer maps brand-specific request and response keys to canonical
Payment Core operations on the server side.

For uniqueness, Layout Builder validates more than names. It compares public
routes, field aliases, status vocabulary, UI labels, palette, layout,
navigation, payload structure, field style, response envelope, dashboard
composition, and copy tone against recent generated brands.

## Quick Validation Checklist

After creating a brand:

1. Open `http://localhost:3004/#layouts`.
2. Select the new brand.
3. Confirm the preview has seeded activity.
4. Click `Open user app`.
5. Confirm `/:brandSlug/app/payments` loads seeded payment activity without a
   login step.
6. Check the browser network tab: requests should use the generated brand slug
   and generated entity routes, not internal Layout Builder or Payment Core
   route names.
