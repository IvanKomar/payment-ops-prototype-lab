# Builder Frontend

Vite local demo UI for the payment operations prototype. It brings the SMS
Gateway, Receipt Recognizer, and Layout Builder flows into one browser console.

## Local Run

From the repository root:

```bash
pnpm run up
```

The frontend starts on `http://localhost:5173`.

To run only the frontend against already-running backend services:

```bash
pnpm run dev:frontend
```

## Backend Routing

The UI uses relative API bases by default:

- `/sms-api` -> `http://localhost:3001`
- `/receipt-api` -> `http://localhost:3002`
- `/layout-api` -> `http://localhost:3003`

Vite proxies those paths during local development, so the browser never needs
cross-origin calls to the NestJS services.

## Demo Flows

- SMS: queue a mock-provider SMS, poll status, and show recent messages.
- Receipts: upload a PhonePe screenshot, choose `tesseract` or `gemini`, and
  inspect normalized fields plus raw OCR text.
- Layouts: create a brand with an uploaded logo or generated SVG mark, manage
  recent demo brands, and preview a live branded SPA built from the brand data
  response. The preview itself is served through an SSR app URL and only calls
  the public brand data endpoint from the browser.
