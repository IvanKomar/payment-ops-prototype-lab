# SMS Gateway

Local prototype NestJS service for queued SMS delivery with mock providers,
country-based routing, fallback, idempotency protection, PostgreSQL persistence,
Redis/BullMQ queueing, and Swagger docs.

## Local Run

From the repository root:

```bash
pnpm docker:up
pnpm --filter @payment-ops/sms-gateway prisma:generate
pnpm --filter @payment-ops/sms-gateway prisma:deploy
pnpm --filter @payment-ops/sms-gateway dev
```

Default port: `3001`.

Swagger UI: `http://localhost:3001/docs`

## API

### Queue SMS

```http
POST /sms/send
Content-Type: application/json
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

The `Idempotency-Key` header is optional. Reusing the same key for the same phone
number and message returns the existing job and does not enqueue another send.
Reusing the same key for a different payload returns `409 Conflict`.

### Check Status

```http
GET /sms/status/:jobId
```

## Provider Routing

- `+380` -> `KyivstarMockProvider`
- `+91` -> `Fast2SmsMockProvider` by default
- `+49`, `+33`, `+44` -> `VonageMockProvider`
- all other valid E.164 numbers worldwide -> `TwilioMockProvider`

Fallback is deterministic: selected country provider, then Vonage, then Twilio,
then remaining mock providers in registration order. This means every valid E.164
phone number has a route, even when the service does not have a country-specific
mock provider.

## Optional Fast2SMS

The real `Fast2SmsProvider` is disabled by default. It is used only when both
conditions are true:

```text
FAST2SMS_ENABLED=true
FAST2SMS_API_KEY=...
```

Tests and the default demo path use mock providers only.
