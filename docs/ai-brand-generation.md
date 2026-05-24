# AI Brand Generation

This guide covers the two supported ways to create a payment gateway brand:

- the built-in admin UI flow, where Layout Builder calls Gemini or the local
  fallback provider;
- the external agent flow, where Codex, Gemini, Claude Code, or another agent
  reads the machine manifest and submits a complete brand spec through HTTP.

Both flows create the same canonical `LayoutBuilderAiBrandSpec`. That spec is
the source of truth for public routes, auth payloads, response shapes, labels,
payment status names, and runtime UI presentation.

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

For real Gemini generation, configure the server-side environment:

```bash
BRAND_AI_PROVIDER=gemini
GEMINI_ENABLED=true
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash-lite
```

If Gemini is not configured, use the `local` provider. The local provider keeps
the prototype working offline and is suitable for demos, but it does not call an
external LLM.

## Flow 1: Built-In Admin UI

1. Open Builder Frontend:

   `http://localhost:3004/#layouts`

2. Go to the `Layout Builder` tab.

3. In the `Brands` sidebar, click `Create AI brand`.

4. Fill in:

   - `Brand name`
   - `Prompt`
   - `Provider`: `Gemini` or `Local fallback`
   - optional `Generation controls`

5. Click `Preview spec`.

6. Review the validation preview. The final `Create brand` button stays
   disabled until the generated spec is valid.

7. Click `Create brand`.

After creation, the brand appears in the brand list. The admin preview renders
the generated brand runtime, and `Open user app` opens the standalone
brand-facing application on the Brand Runtime service. AI brand creation also
seeds a demo merchant account automatically, so new brands should already have
payments, customers, methods, intents, and balance activity when selected.

## Flow 2: External Agent

External agents should not read the repository to guess the contract. They can
discover the system through the manifest endpoint:

```bash
curl http://localhost:3003/ai-agent/brand-generation-manifest
```

The same manifest is also available under the Layout Builder route:

```bash
curl http://localhost:3003/brands/ai/agent-manifest
```

The manifest includes:

- supported flows and endpoints;
- JSON schemas for draft creation and spec import;
- allowed enum values for generation controls and UI presentation;
- reserved route slugs;
- validation rules;
- example prompts;
- a full valid `LayoutBuilderAiBrandSpec` example;
- safety rules for generated UI, including no `brandId`, no `/bff`, no
  `/runtime`, no `/profile`, and no canonical endpoint names in browser-visible
  requests.

### Create a Draft From an Agent Spec

1. Ask the agent to generate a complete `LayoutBuilderAiBrandSpec` using the
   manifest rules.

2. Submit the generated spec:

```bash
curl -X POST http://localhost:3003/brands/ai/drafts/from-spec \
  -H "content-type: application/json" \
  -d @brand-draft.json
```

`brand-draft.json` shape:

```json
{
  "brandName": "Aster Vault",
  "adminPrompt": "External agent generated a merchant payment gateway brand.",
  "provider": "codex",
  "model": "external-agent",
  "controls": {
    "payloadStructure": "nested",
    "fieldStyle": "snake_case",
    "authShape": "workspace",
    "responseEnvelope": "resource_key",
    "routeNaming": "finance",
    "errorStyle": "branded",
    "namingIntensity": "maximum"
  },
  "spec": {}
}
```

Replace `spec` with the full `LayoutBuilderAiBrandSpec` produced by the agent.

3. If the draft response has `"status": "valid"`, create the brand:

```bash
curl -X POST http://localhost:3003/brands/ai/drafts/YOUR_DRAFT_ID/create \
  -F logo=@/path/to/logo.svg
```

### Direct Create From an Agent Spec

Use this when the agent should import and create in one call:

```bash
curl -X POST http://localhost:3003/brands/ai/drafts/from-spec/create \
  -F 'payload=<brand-draft.json;type=application/json' \
  -F logo=@/path/to/logo.svg
```

The backend validates the spec first. It rejects duplicate routes,
reserved/internal slugs, missing required entities, incomplete 10-status maps,
invalid aliases, unsupported UI presentation values, and specs that are too
similar to recent active AI brands.

## Runtime Presentation Variety

The runtime uses `ui.presentation` from the brand spec for more than colors:

- `layout` selects a materially different dashboard composition, such as
  terminal signal streams, command-center boards, card-operation receipt tiles,
  split workspaces, or topbar consoles.
- `navigationPattern` controls sidebar, top-tab, or collapsible command-rail
  navigation.
- `visualTokens.typography` maps to distinct Google Font stacks, including
  JetBrains Mono, IBM Plex Sans Condensed, Space Grotesk, Source Sans 3, and
  Manrope.
- `visualTokens.palette`, density, radius, surface, button, and copy-tone
  tokens affect runtime CSS variables and generated preview styling.

When authoring external specs, prefer explicit, domain-specific presentation
language. Avoid requesting only color changes; describe the workflow shape,
primary widget type, and desired information hierarchy.

## Runtime Expectations

Generated brands open as:

```text
http://localhost:3006/:brandSlug/app/:view
```

Browser-visible API calls should use only AI-generated brand routes, for
example:

```text
/:brandSlug/me
/:brandSlug/pulse
/:brandSlug/ledger
/:brandSlug/client-book
```

The browser should not show:

- `brandId`
- `/bff`
- `/runtime`
- `/profile`
- `/rest-api`
- canonical entity names when the spec uses different route slugs

The BFF layer maps brand-specific request and response keys to canonical
Payment Core operations on the server side.

## Quick Validation Checklist

After creating a brand:

1. Open `http://localhost:3004/#layouts`.
2. Select the new brand.
3. Confirm the preview already has seeded activity.
4. Click `Open user app`.
5. Register or log in.
6. Create a payment and inspect the history table.
7. Check the browser network tab: requests should use the generated brand slug
   and generated entity routes, not internal Layout Builder or Payment Core
   route names.
