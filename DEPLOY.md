# Deploying +233 Kitchen

You'll set up three things, in this order:

1. **MongoDB Atlas** (database)
2. **Email**: the owner's **Gmail** now; switch to **Resend** on your own domain later (env-only)
3. **Vercel** (hosting for the site and API)

Allow about 45 minutes.

> **Production refuses to start with incomplete settings.** When `NODE_ENV=production` or
> `VERCEL=1`, the API checks `MONGODB_URI`, `JWT_SECRET` (≥ 32 characters), an `https://`
> `SITE_URL`, a working email provider, `EMAIL_FROM` and `OWNER_EMAIL`. If anything is missing,
> every API request fails and **Vercel → Logs** lists exactly what to fix. There is no in-memory
> database, no default admin and no "pretend" email sending in production.

---

## 1. MongoDB Atlas

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. **Create a cluster.** Choose **M0 (Free)**, provider AWS, region **us-east-1 (N. Virginia)**
   (closest to Vercel's default region). Name it `k233`.
3. **Create a database user** (Security → Database Access → _Add New Database User_):
   - Authentication: Password
   - Username: `k233app`
   - Password: click _Autogenerate_ and **copy it somewhere safe**
   - Role: _Read and write to any database_
4. **Allow network access** (Security → Network Access → _Add IP Address_):
   - Enter `0.0.0.0/0` (_Allow access from anywhere_) and confirm.
   - This is required because Vercel's serverless functions don't have fixed IP addresses. Access
     is still protected by the username and password.
5. **Get the connection string** (Database → _Connect_ → _Drivers_ → Node.js) and add the database
   name `k233` after the host:
   ```
   mongodb+srv://<db-user>:<db-password>@<your-cluster-host>/k233?retryWrites=true&w=majority&appName=k233
   ```
   If the password contains special characters (`@ : / ? # %`), URL-encode them
   (e.g. `@` → `%40`). This full string is your **`MONGODB_URI`**.

> The free M0 tier has no automatic backups. Export customers and orders regularly from the admin
> (CSV), or upgrade to a paid tier with backups once the business grows.

---

## 2. Email

All email settings are environment variables; switching provider never needs a code change.

### 2a. Gmail (now)

1. Sign in to the owner's Gmail account and turn on **2-Step Verification**
   (<https://myaccount.google.com/security>).
2. Create an **App password** at <https://myaccount.google.com/apppasswords> (name it
   "233 Kitchen website"). Google shows 16 letters like `abcd efgh ijkl mnop`; that is `SMTP_PASS`
   (spaces are fine, they are ignored). It is **not** the normal Gmail password.
3. Use these values:

   | Name             | Value                                                         |
   | ---------------- | ------------------------------------------------------------- |
   | `EMAIL_PROVIDER` | `gmail`                                                       |
   | `SMTP_HOST`      | `smtp.gmail.com`                                              |
   | `SMTP_PORT`      | `465`                                                         |
   | `SMTP_SECURE`    | `true`                                                        |
   | `SMTP_USER`      | the owner's Gmail address, e.g. `owner@gmail.com`             |
   | `SMTP_PASS`      | the App password from step 2                                  |
   | `EMAIL_FROM`     | `+233 Kitchen <owner@gmail.com>` (**must** match `SMTP_USER`) |
   | `OWNER_EMAIL`    | the owner's Gmail (gets every new-order email)                |
   | `EMAIL_REPLY_TO` | _(optional)_ defaults to `OWNER_EMAIL`                        |

   Gmail only sends "From" the account you log in with, so the API refuses to start if
   `EMAIL_FROM` uses a different address.

4. **Replies:** customer emails (order received, status updates, marketing) carry
   `Reply-To: OWNER_EMAIL` (or `EMAIL_REPLY_TO`), so a customer pressing Reply reaches the owner.
   The owner's new-order email has `Reply-To` set to the customer.

**Gmail's daily limit.** A Gmail account can send about **500 emails per day**. Order emails
always go out. Marketing emails go out in batches of 50 (5 seconds apart) and **pause at 400 sent
in the last 24 hours**, keeping room for order emails. The composer warns before sending, and a
paused campaign shows a **Resume** button in Campaign history for the next day; nobody gets an email
twice, and anyone who unsubscribed in the meantime is skipped. Tune with `EMAIL_DAILY_LIMIT`,
`EMAIL_BATCH_SIZE` and `EMAIL_BATCH_DELAY_MS`.

### 2b. Later: Resend on your own domain

When you have a domain (e.g. `233kitchen.com`):

1. Sign up at <https://resend.com> → **Domains → Add Domain** (region us-east-1).
2. Add **each DNS record exactly as Resend shows it** at your registrar (typically an `MX` and a
   `TXT` on `send`, a DKIM `TXT` on `resend._domainkey`, and a recommended `_dmarc` `TXT`
   `v=DMARC1; p=none;`). Wait until the domain shows **Verified**.
3. **API Keys → Create API Key** (Sending access, your domain). It starts with `re_`.
4. In Vercel (Production), change only these and redeploy:

   | Name                | Value                                                   |
   | ------------------- | ------------------------------------------------------- |
   | `EMAIL_PROVIDER`    | `resend`                                                |
   | `RESEND_API_KEY`    | `re_…`                                                  |
   | `EMAIL_FROM`        | `+233 Kitchen <orders@233kitchen.com>`                  |
   | `EMAIL_DAILY_LIMIT` | `0` for no cap, or your Resend plan's limit (free: 100) |

   You can then delete `SMTP_USER` / `SMTP_PASS` and revoke the Gmail App password.

### 2c. Check it after every deploy

Admin → **Settings → Notifications → Send test email to me** sends a real email to the logged-in
admin and shows the exact result. **Test the new-order inboxes** sends one to every new-order
address. Failures (and their reasons) are listed in Admin → **Email log**, where they can be re-sent.

---

## 3. Vercel

### 3a. Put the code on GitHub

```bash
git remote add origin https://github.com/<you>/233-kitchen.git
git push -u origin main
```

### 3b. Import the project

1. Sign up at <https://vercel.com> with GitHub.
   - **Plan:** Vercel's free _Hobby_ plan is for non-commercial use. For a business, use **Pro**.
2. _Add New… → Project_ → import the `233-kitchen` repo.
3. Vercel detects **Vite** from `vercel.json`. Leave Build Command (`npm run build`) and Output
   Directory (`dist`) as they are. Root Directory: `./`.
4. Open **Environment Variables** and add the following with **Environment: Production only**
   (untick Preview and Development; see [Preview deployments](#preview-deployments)):

   | Name          | Value                                                      |
   | ------------- | ---------------------------------------------------------- |
   | `MONGODB_URI` | your Atlas string from step 1                              |
   | `JWT_SECRET`  | 32+ random characters: `openssl rand -base64 48`           |
   | `SITE_URL`    | `https://233-kitchen.vercel.app` or your domain (no `/`)   |
   | `TZ_BUSINESS` | `America/New_York`                                         |
   | email         | everything from [2a. Gmail](#2a-gmail-now) (or 2b. Resend) |

   Don't add `ADMIN_EMAIL` / `ADMIN_PASSWORD` to Vercel; admins are created from your computer
   (step 4).

5. Click **Deploy**. Then open **Vercel → Logs** and look for
   `📧 Email: smtp (Gmail) from +233 Kitchen <…> → owner …`. A `Refusing to start` error lists
   any missing variable.

### 3c. Custom domain (optional)

1. Project → Settings → **Domains** → add `yourdomain.com` (and `www.yourdomain.com`, set to
   redirect to the apex).
2. Add the DNS records Vercel shows at your registrar (usually an `A` record for `@` →
   `76.76.21.21` and a `CNAME` for `www` → `cname.vercel-dns.com`).
3. Set `SITE_URL` to `https://yourdomain.com`, then **Redeploy**. `SITE_URL` is baked into the
   Open Graph tags, sitemap and email links at build time, and it is the only origin the API
   accepts cross-origin requests from.

---

## 4. Database setup and admin accounts

Run these from your computer, in the project folder. They use `MONGODB_URI` from `.env` (or from
the command line, which wins over `.env`).

**Menu and settings** (once). Only creates what is missing; an existing menu or settings are never
touched unless you add `-- --force`, which replaces them with the defaults:

```bash
npm run seed
```

**Admin accounts.** You are asked for the password twice (hidden, at least 10 characters). It is
never typed on the command line or stored in a file:

```bash
npm run admin:set -- --email you@gmail.com          # the developer
npm run admin:set -- --email owner@gmail.com        # the owner
npm run admin:list                                   # who can log in
npm run admin:remove -- --email you@gmail.com       # when handing over (never removes the last admin)
```

Running `admin:set` for an existing email **changes that admin's password** and signs them out on
every device. That is also how to reset a forgotten password. Each admin can change their own
password in **Settings → Change password**, which also signs out their other sessions.

---

## 5. Clear test data before launch

Test orders, customers, emails and campaigns can be removed in one go. Menu items, settings and
admin accounts are kept, and order numbers restart at **233-0001**:

```bash
npm run prod:reset-test-data -- --dry-run   # shows what would be deleted; changes nothing
npm run prod:reset-test-data                # backs up, asks you to type the database name, deletes
```

Before deleting, it writes a full JSON backup to `backups/<timestamp>/` (not committed to git).
Restore a collection with
`mongoimport --uri "$MONGODB_URI" --collection orders --jsonArray --file backups/<timestamp>/orders.json`.

---

## 6. Go-live checklist

- [ ] Admin → Settings → **Send test email to me** says "sent", and it arrives.
- [ ] Place a real test order on the live site from your phone.
- [ ] The owner receives the **🧾 New order** email within a minute.
- [ ] The customer email arrives (check spam the first time; mark it "Not spam"). Replying to it
      goes to the owner.
- [ ] In `/admin`, the order appears, a toast pops up within 20s on an open admin tab, and marking it
      **Confirmed** sends the customer a confirmation email.
- [ ] Admin → **Email log** shows no failures.
- [ ] **Prep sheet** shows the order; **Print slips** prints cleanly.
- [ ] Run `npm run prod:reset-test-data` to remove the test order (section 5).
- [ ] Share the link on WhatsApp/Instagram and check the preview card shows the logo and food image.

## Updating the site later

Push to `main` and Vercel redeploys automatically. Menu, prices, settings and copy that live in the
admin change instantly, with no deploy needed.

### Database migrations

Some releases change data that already lives in Atlas. Run the migration **before** pushing the
release, from your computer, in the project folder. Each one is safe to run more than once.

| Release  | Command                             | What it changes                                                                                                                                                                 |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oct 2026 | `npm run migrate:client-updates`    | Waakye description ("spaghetti") and the full pickup address in Settings                                                                                                        |
| Oct 2026 | `npm run migrate:menu-images-icons` | Menu only: plated images, "What you'll receive" box photos, extras icons, Ice Kenkey photo + order, adds the Braised Rice Plate. Keeps prices and descriptions edited in admin. |

```bash
MONGODB_URI="mongodb+srv://<db-user>:<db-password>@<your-cluster-host>/k233?retryWrites=true&w=majority" \
npm run migrate:menu-images-icons
```

It prints what it inserted and which fields it filled in per dish. A second run prints
`Inserted: none`, `Updated: none`.

## Troubleshooting

| Symptom                                                           | Fix                                                                                                                                 |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Site loads but menu says "couldn't load"                          | `MONGODB_URI` wrong, or Atlas Network Access missing `0.0.0.0/0`. Check Vercel → Deployments → Functions logs.                      |
| `Refusing to start: production configuration is incomplete`       | The log lists each missing variable. Add them in Vercel (Production) and redeploy.                                                  |
| Email log: `Invalid login` / `Username and Password not accepted` | `SMTP_PASS` must be a Gmail **App password**, and 2-Step Verification must be on. Create a new one and redeploy.                    |
| Email log: "domain is not verified" (Resend)                      | Finish Resend DNS verification, then press **Resend** on each failed email.                                                         |
| Marketing email paused                                            | The daily limit was reached (section 2a). Press **Resume** in Campaign history the next day.                                        |
| Admin login keeps returning to the login page                     | The browser is blocking cookies (e.g. private mode with strict settings), or you're on plain `http://`. Use the `https://` address. |
| "Too many login attempts"                                         | 10 failed attempts per 15 minutes per network; wait 15 minutes.                                                                     |
