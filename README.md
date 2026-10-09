# +233 Kitchen

Pre-order website and admin dashboard for **+233 Kitchen**, a Ghanaian home kitchen in Worcester, MA.
Customers pre-order online and pick up on Wednesdays. There is no online payment. The owner gets an
instant email for every order and manages everything from `/admin`.

## Quick start (no accounts or credentials needed)

```bash
npm install
npm run dev
```

- Site: <http://localhost:5173>
- Admin: <http://localhost:5173/admin>, log in with **admin@233kitchen.local / admin1234**. This
  login exists only in the local dev database (`server/devDb.ts`); production refuses to start
  without a real database and never creates a default admin.

With an empty `.env`, `npm run dev` runs three processes:

| Process | What it does                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db`    | A local MongoDB (mongodb-memory-server), auto-seeded with the menu, settings and admin user. Data persists in `./.data/mongo`. Delete that folder to start fresh.               |
| `api`   | Express API on :3001, hot-reloaded with `tsx watch`, and restarted automatically when `.env` / `.env.local` change. On start it logs the active email provider (`📧 Email: …`). |
| `web`   | Vite on :5173, proxying `/api` to the API.                                                                                                                                      |

Emails aren't sent in dev. They're printed to the terminal, saved as HTML in `./.email-previews/`,
and recorded in the admin **Email log** as "Sent (dev)".

To use real services locally, copy `.env.example` to `.env` and fill in the variables.

> **Careful:** with `MONGODB_URI` in `.env`, `npm run dev` and every script (`seed`, `admin:set`,
> `prod:reset-test-data`, migrations) use **that** database, which is production if it's the Atlas
> URI. Leave it empty for local work; tests never read `.env`.

## Scripts

| Command                           | Purpose                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                     | Local DB + API + site                                                       |
| `npm run build`                   | Type-check the client and build `dist/`                                     |
| `npm run typecheck`               | Type-check client and server                                                |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                           |
| `npm test`                        | Vitest: pricing, schedule, orders, admin, email, security, reset tool, UI   |
| `npm run seed`                    | Seed menu + settings if missing (`-- --force` replaces them); see DEPLOY.md |
| `npm run admin:set -- --email x`  | Create an admin or change a password (typed, hidden); `admin:list`/`remove` |
| `npm run prod:reset-test-data`    | Back up, then delete test orders/customers/emails (`-- --dry-run` first)    |
| `npm run email:test -- you@x.com` | Send one real email through the configured provider                         |
| `npm run images`                  | Rebuild WebP images, favicons and the OG image from `./reference`           |

## Structure

```
api/index.ts        Vercel serverless entry: exports the Express app
server/             Express app, Mongoose models, routes, services, email templates
  services/         pricing/order flow, email (Gmail/SMTP | Resend | dev), analytics, campaigns, prep sheet
shared/             Types, Zod schemas, menu seed, pricing + schedule logic (used by client AND server)
src/                React app (public site); src/admin/ is a separate lazy-loaded bundle
  content/site.ts   Marketing copy, including the hero headline (edit words here)
  components/hero/  Isolated hero + HeroVisual (swap for 3D/Spline later)
  components/BrandIcon.tsx  Single icon slot (drop in 3D PNGs later)
scripts/            Image pipeline, local dev database
tests/              Vitest suites
reference/          Original brand photos and logo
```

## How it works (key rules)

- **Prices are always recalculated on the server** from the database (`shared/pricing.ts`). Prices sent
  by the browser are ignored.
- **Cutoff and pickup dates** use America/New_York via Luxon (`shared/schedule.ts`). The default is
  Wednesday pickup, with orders closing Monday at 11:59 PM. The whole minute counts, and DST is handled.
- **Capacity** per pickup window is optional (Settings). Cancelled orders free up space.
- **Order numbers** (`233-0001`) come from an atomic counter.
- **Emails never block an order.** The order is saved first, then emails are sent. Failures are logged
  and can be re-sent from the admin.
- **Marketing** goes only to opted-in customers, with an unsubscribe link, one-click
  `List-Unsubscribe` headers and the postal address. One-to-one messages to a single customer are allowed.
- **Security:** helmet, CORS locked to `SITE_URL`, Mongo-backed rate limits (shared across serverless
  instances), `$`-key stripping + strict Zod validation, bcrypt, JWT in an httpOnly / Secure /
  SameSite=Strict cookie, sessions revoked on password change.

## Editing content

- **Headline and marketing copy:** `src/content/site.ts`
- **Menu, prices, sold-out:** Admin → Menu
- **Pickup days, windows, cutoff, pause, payment text, address, phone, socials:** Admin → Settings
- **Images:** `npm run images` builds any missing outputs and never overwrites existing ones
  (`-- --force` rebuilds). Plated photos: `reference/ai/dishes/<dish>.jpg` → `public/images/` (480/720/960/1600).
  Real box photos: `reference/*.jpeg` → `public/images/box/`. Icons:
  `reference/ai/icons-cutout/icon-<name>.png` → `public/icons/`. See `reference/ai/README.md`.
- **Replacing an image:** files in `public/images` and `public/icons` are cached for a year, so URLs
  carry a content hash (`assetUrl()` in `shared/assets.ts`, from `shared/asset-manifest.json`).
  After adding or replacing a file, run `npm run images` (or `npm run assets:manifest`) and commit
  the manifest; `npm run build` refuses to build if it's out of date.
- **Gallery photos:** listed in `src/content/gallery.ts` (plated photos from `public/images`).
- **Menu photos, "What you'll receive" box photos and extras icons:** Admin → Menu → edit a dish.
- **Map location:** Admin → Settings → Map location (public)

Deployment: see [DEPLOY.md](DEPLOY.md). Owner guide: [HANDOVER.md](HANDOVER.md). Open questions:
[OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
