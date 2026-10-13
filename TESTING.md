# Workflow regression tests

Install dependencies in both client and server, then install Chromium with `npx playwright install chromium` from client.

Start the frontend with `npm run dev` in client. Run `npm test` in server. The suite starts its own API on an unused local port; a running backend is not required. server/.env must contain the configured DATABASE_URL and JWT_SECRET.

The suite creates uniquely named temporary organizer/vendor accounts, exercises registration/login, permissions, requirements, services/packages, blocked dates, concurrent bookings, budget totals, messaging, reviews, notification preferences, earnings, and account deletion. Playwright checks public and organizer/vendor pages and saves an event time in Asia/Kolkata without changing the instant. Test accounts and their dependent records are cleaned up in a finally block. Existing account and event IDs are checked afterward.

Set TEST_CLIENT_URL if Vite uses a different URL. SKIP_BROWSER=1 runs just API checks. Do not run this suite concurrently because it checks the database account/event inventory before and after each run.

Frontend verification: `npm run build` and `npm run lint` from client.

Run `npm run test:vendor` from server for vendor-specific action and result checks, including past/future dashboard counts, earnings with paise, catalog CRUD and ownership, calendar conflicts, quote edits and navigation, reviews, messages, notifications, profile image upload, password changes, and account deletion. It uses disposable accounts and removes its uploaded test image.

Run `npm run test:organizer` from server for organizer action, ownership, budget arithmetic/concurrency, free-price sorting/comparison, profile synchronization, delayed budget responses, and account lifecycle checks with disposable accounts.

Run `npm run test:deployment` from server for hermetic Vercel HTTP, cloud-upload validation, trusted-origin, Redis rate-limit, and cross-instance Socket.IO checks. Cloud SDK/database calls are replaced with test doubles; no cloud accounts are changed. Run the browser and API workflow suites for application regressions.
