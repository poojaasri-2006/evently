# Deploy Evently as one Vercel project

The React frontend and the Express/Socket.IO API deploy from this repository together. The frontend calls /api on its own domain. Import the repository root, not the client or server directory.

## 1. Project settings

- Root Directory: repository root (leave blank in Vercel).
- Framework Preset: Vite. vercel.json defines the build and output directory.
- Node.js version: 22.x.
- Install: npm ci --include=dev.
- Build: npm run build.
- Output: client/dist.
- Use Fluid compute and Vercel's current WebSocket support (public beta).

No API URL needs to be set for this deployment. Leave VITE_API_URL and VITE_SOCKET_PATH unset. Local npm run dev still calls the backend at localhost:5000.

## 2. Required Vercel environment variables

| Variable | Value |
| --- | --- |
| DATABASE_URL | Hosted PostgreSQL connection string, preferably pooled; use a small connection_limit suitable for your database plan. |
| JWT_SECRET | A long random secret. Keep this server-side. |
| REDIS_URL | Redis TCP/TLS connection URL from a Vercel Marketplace Redis integration, such as Upstash. Use rediss:// for TLS, not the provider's REST URL. |
| BLOB_READ_WRITE_TOKEN | Attach a PUBLIC Vercel Blob store to this project; it supplies this token. |
| EVENT_TIMEZONE | Asia/Kolkata |

CLIENT_URL is optional for same-domain hosting. If using a separate frontend, set its exact HTTPS origin. Multiple explicitly trusted origins may be comma-separated. Preview deployments accept their own origin without allowing all vercel.app sites.

Choose backend/database/Redis regions close to each other. Use separate test resources for Preview deployments if they should not modify production data. Never put database credentials, JWT_SECRET, Redis credentials, or the Blob token in a VITE_ variable: those variables are public frontend code.

## 3. Database

Prisma Client and the Vercel Linux query engine are generated during installation. Builds do not automatically change the database.

For a new empty PostgreSQL database, set DATABASE_URL in your shell to its migration-capable connection string and run npm run db:deploy once. For the existing working database, check its migration history before applying migrations. Do not reset or re-create an existing database to deploy the application.

## 4. Existing profile photos

Local uploads are not packaged into Vercel. New uploads use Vercel Blob and are limited to 4 MB to fit the function request limit.

Before going live, make existing local photos durable using the provided migration script. In your local shell, configure DATABASE_URL for the intended database and BLOB_READ_WRITE_TOKEN for the new public store:

    npm run images:migrate

This first command only reports eligible/missing images. Review the result, then migrate the eligible files and their database URLs:

    npm run images:migrate -- --apply

The script only reads this project's matching vendor photo files. It preserves the original files and uses a conditional database update so a newer profile photo is not overwritten. Missing old photos need to be re-uploaded.

## 5. Deploy and verify

Import the Git repository into Vercel, configure the variables above for the deployment environment, then deploy.

- /api/health should return {"status":"ok"}.
- Refresh /organizer/dashboard and /vendor/dashboard directly to verify SPA routing.
- Check login, events, quotes, budgets, bookings, and notifications with test accounts.
- Upload a profile image and verify the URL belongs to the Blob store and persists after a redeployment.
- Connect two accounts in separate browsers and verify live notifications. Socket.IO uses WebSocket-only transport and Redis to deliver across function instances. Reconnects refresh application data when Vercel rotates a connection.

Old deployed frontend builds using localhost URLs must be refreshed. This repository change prepares deployment; it does not publish a Vercel project or provision cloud resources.

## Local development

    npm install --include=dev
    npm start

Run npm run dev in a second terminal. Database/JWT configuration is read from server/.env by the local server. Redis and Blob are optional locally: without them, notifications use one local Socket.IO instance and uploads use server/uploads/profiles.

References: https://vercel.com/docs/frameworks/frontend/vite, https://vercel.com/docs/functions/websockets, https://vercel.com/docs/vercel-blob, https://socket.io/docs/v4/redis-adapter/
