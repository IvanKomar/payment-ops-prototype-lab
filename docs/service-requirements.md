# Service Requirements

This document keeps detailed service behavior separate from the main
architecture document. It should be updated at the start of each phase when
implementation decisions become more concrete.

## SMS Gateway

### Request

`POST /sms/send`

Optional duplicate-send guard:

```http
Idempotency-Key: otp-login-usr_123-2026-05-13T17:30
```

```json
{
  "phoneNumber": "+919876543210",
  "message": "Your OTP is 123456",
  "metadata": {
    "source": "demo"
  }
}
```

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
- returns `receiptId`;
- stores raw OCR text and normalized result.

### Result

```ts
export type ReceiptNormalizerKind = "regex" | "gemini" | "anthropic";

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
```

### Normalizer Interface

```ts
export interface IReceiptNormalizer {
  normalize(rawText: string): Promise<ReceiptData>;
}
```

### Normalizer Selection

- `NORMALIZER=regex` is default.
- `NORMALIZER=gemini` requires `GEMINI_ENABLED=true` and `GEMINI_API_KEY`.
- `NORMALIZER=anthropic` is a placeholder and should fall back without a key.
- Any optional provider error falls back to `RegexNormalizer`.

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
- palette extraction through `node-vibrant`;
- generated per-brand API schema.

### Dynamic Schema Shapes

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
  "endpoint": "/brands/br_abc123/configure_x9k2",
  "method": "POST",
  "fieldsStyle": "snake_case",
  "structure": "flat",
  "fields": {
    "title": "company_title_8fa",
    "primaryColor": "primary_color_2x",
    "layoutVariant": "variant_q3"
  }
}
```

### Rendering

- Render SVG first.
- Optional PNG export can be added later through Puppeteer.
- Use seeded randomness with `brandId` as the seed.
- Keep output deterministic for the same brand/config pair.

### Dashboard Layout Reference

One template must be based on the provided KOI-style payments dashboard:

- top bar with logo/name;
- `P2P / INTENT` segmented control;
- date and user icon;
- `Payments` title and balance badge;
- search by transaction id;
- filters for method, type, status, date from, date to;
- actions for page size, support report, finance reconciliation report, refresh;
- payments table with transaction id, status, requested amount, paid amount,
  created time, paid time, type, and method;
- compact status badges;
- copy icon near transaction id;
- scrollable table body.
