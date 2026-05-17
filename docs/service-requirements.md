# Service Requirements

This document keeps detailed service behavior separate from the main
architecture document. It should be updated at the start of each phase when
implementation decisions become more concrete.

## SMS Gateway

### Request

`POST /sms/send`

```json
{
  "phoneNumber": "+919876543210",
  "message": "Your OTP is 123456",
  "metadata": {
    "source": "demo"
  }
}
```

Duplicate-send protection is server-side. Repeating the same phone number and
message within five minutes returns the existing job instead of queueing another
send. The window uses server time, independent of client time zones. After five
minutes, the same phone number and message can be queued again.

### Response

```json
{
  "jobId": "sms_...",
  "status": "queued",
  "provider": "Fast2SmsMockProvider"
}
```

### Status

`GET /sms/status/:jobId`

```json
{
  "jobId": "sms_...",
  "status": "sent",
  "provider": "Fast2SmsMockProvider",
  "attempts": 1,
  "lastError": null
}
```

### Recent Messages

`GET /sms/recent`

Returns the latest 10 persisted SMS messages, newest first, including job id,
phone number, message, status, provider, attempts, last error, dedupe key,
creation time, and sent time.

### Provider Interface

```ts
export interface ISmsProvider {
  readonly name: string;
  canHandle(phoneNumber: string): boolean;
  send(input: SmsSendInput): Promise<SmsSendResult>;
  getStatus(providerMessageId: string): Promise<SmsProviderStatus>;
}
```

### Routing

- `+380` -> `KyivstarMockProvider`
- `+91` -> `Fast2SmsMockProvider`
- `+49`, `+33`, `+44` -> `VonageMockProvider`
- all other valid E.164 numbers worldwide -> `TwilioMockProvider`

### Mock Behavior

- Providers simulate latency and failures.
- Success rate and latency range must be configurable through env vars or
  provider config objects.
- Fallback tries the next provider when the selected provider fails.
- Tests must cover country routing and fallback.

### Fast2SMS Optional Adapter

- Real adapter name: `Fast2SmsProvider`.
- Enabled only with `FAST2SMS_ENABLED=true` and `FAST2SMS_API_KEY`.
- API endpoint: `POST https://www.fast2sms.com/dev/bulkV2`.
- Auth: `authorization` header.
- Supported documented routes: `dlt`, `dlt_manual`, `otp`, `q`.
- Tests and default demos must use mock transport only.

## Receipt Recognizer

### Upload

`POST /receipts/upload`

- multipart image upload;
- optional `model=tesseract|gemini`, defaulting to `tesseract`;
- returns `receiptId`, `requestedModel`, and `recognitionModel`;
- stores raw OCR text, normalized result, requested model, and actual recognition
  model.

### Result

```ts
export type ReceiptNormalizerKind = "regex" | "gemini" | "anthropic";
export type ReceiptRecognitionModel = "tesseract" | "gemini";

export interface ReceiptData {
  bank: string | null;
  transactionDate: string | null;
  amount: number | null;
  currency: string | null;
  sender: string | null;
  recipient: string | null;
  transactionId: string | null;
  utr: string | null;
  confidence: number;
  rawText: string;
  normalizedBy: ReceiptNormalizerKind;
}

export interface ReceiptRecognizerUploadReceiptResponse {
  receiptId: string;
  requestedModel: ReceiptRecognitionModel;
  recognitionModel: ReceiptRecognitionModel;
}
```

Persisted receipts include `requestedModel` and `recognitionModel`, so the API
can show when a `gemini` request fell back to local `tesseract`.

### Normalizer Interface

```ts
export interface IReceiptNormalizer {
  normalize(rawText: string): Promise<ReceiptData>;
}
```

### Normalizer Selection

- `NORMALIZER=regex` is default.
- `GEMINI_MODEL=gemini-2.5-flash-lite` is the default Gemini API model.
- `model=gemini` requires `GEMINI_ENABLED=true` and `GEMINI_API_KEY`.
- `NORMALIZER=anthropic` is a placeholder and should fall back without a key.
- Any Gemini provider error, quota error, missing key, or invalid JSON falls back
  to Tesseract.js plus `RegexNormalizer`.

### Recent Receipts

`GET /receipts/recent`

Returns the latest 10 receipts, newest first, including requested/actual model,
structured payment fields, confidence, raw OCR text, and timestamps.

### PhonePe Fixtures

Store the provided screenshots here:

```text
apps/receipt-recognizer/test-fixtures/phonepe/
```

Expected fixture names:

- `phonepe-axis-bank-10000.jpg`
- `phonepe-yes-bank-25618.jpg`
- `phonepe-icici-bank-13000.jpg`

Known values from fixtures:

| Fixture | Amount | Recipient | Transaction ID | UTR |
| --- | ---: | --- | --- | --- |
| `phonepe-axis-bank-10000.jpg` | `10000` | `Ansh Anand` | `T21474836471229701068` | `429948609046` |
| `phonepe-yes-bank-25618.jpg` | `25618` | `Jay Prakash Kumar` | `T2604170007543077317626` | `996178679704` |
| `phonepe-icici-bank-13000.jpg` | `13000` | `VISHAL` | `T3748004208605153848062` | `423152720207` |

Regex patterns should handle:

- `Transaction Successful`
- `Paid to`
- `Banking Name`
- `Transaction ID`
- `Debited from`
- `UTR`
- INR amounts with `₹`

## Layout Builder

### Brand Creation

`POST /brands`

- multipart logo upload;
- brand name;
- accepts JPEG, PNG, WebP, and SVG logos;
- palette extraction through `node-vibrant`;
- SVG palettes use local color extraction from sanitized SVG markup;
- uploaded logos are stored on disk;
- generated per-brand API schema.

`GET /brands/recent`

Returns recent brands for the UI sidebar, newest first, including brand id,
name, logo MIME type, palette, public data endpoint, app URL, and timestamps.

`DELETE /brands/:id`

Deletes a brand plus its generated schema and stored requests. Logo file cleanup
is best effort.

### Dynamic Schema Shapes

Each created brand gets a dynamic server contract at the generated endpoint.
The static brand creation endpoint is not the contract itself; it only creates
the brand, stores its logo/palette, and returns the generated contract metadata.

The generated endpoint supports:

- `GET /brands/:id/:slug`: returns the latest dashboard data using the generated
  field names and payload structure.
- `GET /brands/:id/:slug/data`: returns the latest dashboard data for the public
  brand app. This is the only data request made by the browser preview.
- `GET /brands/:id/:slug/app`: returns the server-rendered brand SPA shell with
  schema mapping kept on the server side.
- `POST /brands/:id/:slug`: accepts dashboard data using the generated field
  names and payload structure, stores it as the latest canonical config, and
  updates the rendered layout.

Supported field styles:

- `camelCase`
- `snake_case`
- `kebab-case`

Supported payload structures:

- `flat`
- `nested`
- `key-value-array`

Example flat schema:

```json
{
  "endpoint": "/brands/br_abc123/koi-payments_x9k2",
  "dataEndpoint": "/brands/br_abc123/koi-payments_x9k2/data",
  "appUrl": "/brands/br_abc123/koi-payments_x9k2/app",
  "method": "POST",
  "fieldsStyle": "snake_case",
  "structure": "flat",
  "fields": {
    "title": "title_8fa1",
    "balance": "balance_4be2",
    "currency": "currency_912a",
    "pageSize": "page_size_c177",
    "payments": "payments_72ab"
  }
}
```

### Rendering

- Render SVG and SSR brand app from the same canonical dashboard config.
- Optional PNG export can be added later through Puppeteer.
- Use seeded randomness with `brandId` as the seed.
- Keep output deterministic for the same brand/config pair.
- Embed the stored logo into the rendered SVG as base64.
- Gemini is not used for V1 template generation; the KOI-style dashboard is
  rendered by deterministic local logic.
- The renderer must vary the actual layout by brand id: element positions,
  navigation style, metric composition, table column order, table labels,
  density, actions, and status badge style should not be fixed across all brands.
- Template selection should compare candidates against recent brands so the
  nearest five to six created brands are visually distinct where possible.
- Dashboard payloads intentionally exclude mode/search/filter chips and payment
  row type/method fields. Canonical dashboard data is title, balance, currency,
  page size, and payment rows.

### Dashboard Layout Reference

One template must be based on the provided KOI-style payments dashboard:

- top bar with logo/name;
- date and user icon;
- `Payments` title and balance badge;
- actions for page size, support report, finance reconciliation report, refresh;
- payments table with transaction id, status, requested amount, paid amount,
  created time, and paid time;
- compact status badges;
- copy icon near transaction id;
- scrollable table body.

### UI

- Static browser UI at `/`.
- Left sidebar lists recent brands and lets the user switch between them.
- Brand creation opens in a modal; refresh and delete actions live with the
  brand list rather than inside the preview.
- Main view shows only the live SPA preview rendered from the brand data
  response.
- Live preview loads through a server-rendered brand app URL and the preview
  browser runtime only calls the generated public data endpoint. The generated
  schema remains server-side for preview rendering.
