# Receipt Recognizer

Local prototype NestJS service for receipt screenshot OCR, PhonePe payment
normalization, PostgreSQL persistence, Swagger docs, and a small browser UI.

## Local Run

From the repository root:

```bash
pnpm docker:up
pnpm --filter @payment-ops/receipt-recognizer prisma:generate
pnpm --filter @payment-ops/receipt-recognizer prisma:deploy
pnpm --filter @payment-ops/receipt-recognizer dev
```

Default port: `3002`.

Swagger UI: `http://localhost:3002/docs`

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

## Normalizer

`NORMALIZER=regex` remains the local fallback path. Gemini recognition uses the
configured `GEMINI_MODEL` value, defaulting to `gemini-2.5-flash-lite`.
