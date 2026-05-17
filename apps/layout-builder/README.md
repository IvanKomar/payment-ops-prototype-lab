# Layout Builder

Local prototype NestJS service for dynamic branded dashboard layout generation.
It accepts brand logos, extracts a palette, generates a per-brand API contract,
stores posted dashboard configuration, and renders a deterministic SVG layout.

## Local Run

From the repository root:

To run the whole implemented monorepo:

```bash
pnpm run up
```

To run only Layout Builder:

```bash
pnpm run docker:up
pnpm --filter @payment-ops/layout-builder prisma:generate
pnpm --filter @payment-ops/layout-builder prisma:deploy
pnpm --filter @payment-ops/layout-builder dev
```

Default port: `3003`. Use `LAYOUT_BUILDER_PORT=3003` to override it explicitly
in the monorepo `.env`.

Swagger UI: `http://localhost:3003/docs`

Browser UI: `http://localhost:3003/`

## API

### Create Brand

`POST /brands`

Multipart fields:

- `brandName`
- `logo` as JPEG, PNG, WebP, or SVG

The service stores the logo on disk, extracts a palette, creates a dynamic
brand API schema, and returns the generated endpoint plus a sample payload.
The response also includes the deterministic `layoutVariant` chosen for that
brand.

### Recent Brands

`GET /brands/recent`

Returns the latest brands for the UI sidebar.

### Brand Schema

`GET /brands/:id/schema`

Returns the generated endpoint, field style, payload structure, field mapping,
and sample payload.

### Delete Brand

`DELETE /brands/:id`

Deletes the brand, generated schema, stored dynamic API requests, and attempts
to remove the stored logo file.

### Dynamic Brand API

`GET /brands/:id/:slug`

Returns the latest dashboard data in the generated contract shape for that
brand. If no data has been posted yet, the service returns the default dashboard
data in the generated contract shape.

`POST /brands/:id/:slug`

Accepts the generated schema payload, maps randomized fields to canonical
dashboard config, persists the request, updates the rendered layout, and returns
the stored data in the generated contract shape.

### Render Layout

`GET /brands/:id/layout`

Returns a self-contained SVG with the logo embedded as base64.

## Notes

- Gemini is not used in V1. The KOI-style dashboard is rendered by deterministic
  local logic.
- Brands get different deterministic layout profiles. The renderer varies block
  positions, table column order, column labels, and status badge style.
- Raster palettes use `node-vibrant`.
- SVG palettes use basic color extraction from SVG markup.
- Uploaded SVGs are rejected if they contain scripts, `foreignObject`, inline
  event handlers, JavaScript URLs, or external links.
