# Receipt Recognizer

Local prototype NestJS service for receipt screenshot recognition, PhonePe
payment normalization, PostgreSQL persistence, Swagger docs, and a small browser
UI.

## Local Run

From the repository root:

To run the whole implemented monorepo:

```bash
pnpm run up
```

This runs `pnpm run setup` first, then starts all implemented apps with `pnpm run dev`.

To run only Receipt Recognizer:

```bash
pnpm run docker:up
pnpm --filter @payment-ops/receipt-recognizer prisma:generate
pnpm --filter @payment-ops/receipt-recognizer prisma:deploy
pnpm --filter @payment-ops/receipt-recognizer dev
```

Default port: `3002`. Use `RECEIPT_RECOGNIZER_PORT=3002` to override it
explicitly in the monorepo `.env`.

Swagger UI: `http://localhost:3002/docs`

Browser UI: `http://localhost:3002/`

## API

### Upload Receipt

```http
POST /receipts/upload
Content-Type: multipart/form-data
```

Form field:

```text
file=<jpeg|png|webp>
model=tesseract|gemini
```

The default model is `tesseract`. When `model=gemini` is requested, the service
uses Gemini only if `GEMINI_ENABLED=true` and `GEMINI_API_KEY` are configured;
otherwise it falls back to local Tesseract.js OCR plus regex normalization. The
service stores the requested model and the model actually used.

```json
{
  "receiptId": "rcpt_...",
  "requestedModel": "gemini",
  "recognitionModel": "tesseract"
}
```

Example:

```bash
curl -X POST http://localhost:3002/receipts/upload \
  -F model=gemini \
  -F file=@apps/receipt-recognizer/test-fixtures/phonepe/phonepe-axis-bank-10000.jpg
```

### Fetch Parsed Result

```http
GET /receipts/:id
```

### Fetch Raw OCR Text

```http
GET /receipts/:id/raw
```

### Recent Receipts

```http
GET /receipts/recent
```

Returns the latest 10 persisted receipts, newest first. The local web UI at
`http://localhost:3002/` supports upload, result display, raw OCR viewing, and
history refresh.

## Recognition Models

- `tesseract`: default local path. Runs Tesseract.js OCR and regex
  normalization.
- `gemini`: optional image-to-JSON path. Requires `GEMINI_ENABLED=true` and
  `GEMINI_API_KEY`; uses `GEMINI_MODEL`, defaulting to
  `gemini-2.5-flash-lite`.
- If Gemini is unavailable, fails quota, or returns invalid output, upload falls
  back to `tesseract` and the response/history show that fallback through
  `requestedModel` and `recognitionModel`.

## Confidence

The UI renders confidence as a percentage badge:

- green: `>= 90%`;
- blue: `75-89%`;
- orange: `50-74%`;
- red: `< 50%`.
