# Deploying +233 Kitchen

You'll set up three services, in this order:

1. **MongoDB Atlas** (database)
2. **Resend** (email)
3. **Vercel** (hosting for the site and API)

Allow about 45 minutes. Domain DNS can take longer to verify.

> **Before you start:** buy or choose the domain you'll use (e.g. `233kitchen.com`). Emails must send
> from that domain, and `SITE_URL` must match it.

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
5. **Get the connection string** (Database → _Connect_ → _Drivers_ → Node.js). It looks like:
   ```
   mongodb+srv://<db-user>:<db-password>@<your-cluster-host>/?retryWrites=true&w=majority&appName=k233
   ```
   Replace `<password>` with your password, and add the database name `k233` after `.net/`:
   ```
   mongodb+srv://<db-user>:<db-password>@<your-cluster-host>/k233?retryWrites=true&w=majority&appName=k233
   ```
   If the password contains special characters (`@ : / ? # %`), URL-encode them
   (e.g. `@` → `%40`). This full string is your **`MONGODB_URI`**.

> The free M0 tier has no automatic backups. Export customers and orders regularly from the admin
> (CSV), or upgrade to a paid tier with backups once the business grows.

---

## 2. Resend (email)

1. Sign up at <https://resend.com>.
2. **Add your domain** (Domains → _Add Domain_). Enter your domain (e.g. `233kitchen.com`), region
   **us-east-1**.
3. Resend shows DNS records unique to your account. Add **each one exactly as shown** at your domain
   registrar (GoDaddy, Namecheap, Cloudflare, Google Domains…). They're typically:

   | Type  | Name / Host              | Value (copy from Resend)                              | Purpose                             |
   | ----- | ------------------------ | ----------------------------------------------------- | ----------------------------------- |
   | `MX`  | `send`                   | `feedback-smtp.us-east-1.amazonses.com` (priority 10) | Bounce handling                     |
   | `TXT` | `send`                   | `v=spf1 include:amazonses.com ~all`                   | SPF                                 |
   | `TXT` | `resend._domainkey`      | `p=MIGfMA0GCSq…` (long key)                           | DKIM signature                      |
   | `TXT` | `_dmarc` _(recommended)_ | `v=DMARC1; p=none;`                                   | DMARC (helps Gmail/Yahoo trust you) |

   Some registrars add your domain to the host automatically. If so, enter just `send` and not
   `send.233kitchen.com`.

4. Click **Verify DNS Records**. Verification usually takes a few minutes, but can take up to 48 hours.
   Wait until the domain shows **Verified**.
5. **Create an API key** (API Keys → _Create API Key_, permission _Sending access_, domain = yours).
   Copy it. This is your **`RESEND_API_KEY`** (starts with `re_`).
6. Choose the sender. **`EMAIL_FROM`** must use the verified domain, e.g.
   `"+233 Kitchen <orders@233kitchen.com>"`.
7. Optional: set **`EMAIL_REPLY_TO`** to the owner's personal inbox (e.g. her Gmail), so customer
   replies reach her.

> **Until the domain is verified**, Resend only lets you send _to your own Resend account email_, from
> `onboarding@resend.dev`. Customer emails will fail, but orders still save and the failures show in
> Admin → Email log, where you can **Resend** them once the domain is verified.

### Fallback: Gmail SMTP (only if you can't use Resend)

1. On the Gmail account, turn on 2-Step Verification, then create an **App password**
   (<https://myaccount.google.com/apppasswords>).
2. Set these env vars instead of `RESEND_API_KEY`:
   `EMAIL_PROVIDER=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=the@gmail.com`,
   `SMTP_PASS=<app password>`, `EMAIL_FROM="+233 Kitchen <the@gmail.com>"`.
3. Gmail allows about 500 emails per day and isn't suited to marketing blasts. Use Resend for those.

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
4. Open **Environment Variables** and add the following (Environment: _Production_; add the same to
   _Preview_ if you use preview deployments):

   | Name             | Value                                                                   |
   | ---------------- | ----------------------------------------------------------------------- |
   | `MONGODB_URI`    | your Atlas string from step 1                                           |
   | `JWT_SECRET`     | a long random string. Generate one with `openssl rand -base64 48`       |
   | `ADMIN_EMAIL`    | the owner's login email                                                 |
   | `ADMIN_PASSWORD` | a strong temporary password (≥ 10 characters), used only by the seed    |
   | `OWNER_EMAIL`    | where new-order alerts go (more can be added later in Admin → Settings) |
   | `SITE_URL`       | `https://yourdomain.com` (no trailing slash)                            |
   | `TZ_BUSINESS`    | `America/New_York`                                                      |

   **Email variables, Gmail (SMTP).** All of these are required when sending through Gmail:

   | Name             | Value                                                                    |
   | ---------------- | ------------------------------------------------------------------------ |
   | `EMAIL_PROVIDER` | `smtp`                                                                   |
   | `SMTP_USER`      | the full Gmail address, e.g. `kitchen@gmail.com`                         |
   | `SMTP_PASS`      | the 16-character Gmail **App password** (not the normal Gmail password)  |
   | `EMAIL_FROM`     | `"+233 Kitchen <kitchen@gmail.com>"` (Gmail only sends from `SMTP_USER`) |
   | `EMAIL_REPLY_TO` | where customer replies should go (can be the same Gmail address)         |
   | `OWNER_EMAIL`    | where new-order alerts go (listed above; required for Gmail setups too)  |
   | `SMTP_HOST`      | _(optional)_ defaults to `smtp.gmail.com`                                |
   | `SMTP_PORT`      | _(optional)_ defaults to `465`                                           |

   **Or Resend:** set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` (`re_…` from step 2), `EMAIL_FROM`
   (on your verified domain), `EMAIL_REPLY_TO` and `OWNER_EMAIL`.

   > If `EMAIL_PROVIDER` is set but its credentials are missing, nothing is sent: every email is
   > recorded as **failed** in Admin → Email log, and the function logs a warning each time. Check
   > **Vercel → Logs** after deploying for the line
   > `📧 Email: smtp (Gmail) from … → owner …`, then use **Admin → Settings → Send test email**.

5. Click **Deploy**. When it finishes you'll get a URL like `https://233-kitchen.vercel.app`.

### 3c. Custom domain

1. Project → Settings → **Domains** → add `yourdomain.com` (and `www.yourdomain.com`, set to
   redirect to the apex).
2. Add the DNS records Vercel shows at your registrar (usually an `A` record for `@` →
   `76.76.21.21` and a `CNAME` for `www` → `cname.vercel-dns.com`). Keep the Resend records from step 2.
3. Make sure `SITE_URL` is `https://yourdomain.com`, then **Redeploy**. `SITE_URL` is baked into the
   Open Graph tags, sitemap and email links at build time.

---

## 4. Seed the production database

Run this **once**, from your computer, in the project folder. It creates the menu, the default
settings and the admin account in Atlas:

```bash
MONGODB_URI="mongodb+srv://<db-user>:<db-password>@<your-cluster-host>/k233?retryWrites=true&w=majority" \
ADMIN_EMAIL="owner@yourdomain.com" \
ADMIN_PASSWORD="a-strong-temporary-password" \
OWNER_EMAIL="owner@yourdomain.com" \
TZ_BUSINESS="America/New_York" \
npm run seed
```

You should see `Seed complete: { menuCreated: 4, settingsCreated: true, adminCreated: true, … }`.
Running it again is safe: it only creates what's missing.

> If your home IP can't reach Atlas, check that Network Access includes `0.0.0.0/0` (step 1.4).

---

## 5. First login and password change

1. Open `https://yourdomain.com/admin` and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. Go to **Settings → Change password** and set a new, private password. This also signs out every
   other session.
3. In **Settings**, check the payment instructions, the pickup address, the notification emails,
   pickup windows and social links.
4. If the password is ever forgotten, reset it from your computer:
   ```bash
   MONGODB_URI="…" ADMIN_EMAIL="owner@yourdomain.com" ADMIN_PASSWORD="new-password-here" \
   npm run seed -- --reset-admin-password
   ```

---

## 6. Go-live checklist

- [ ] Place a real test order on the live site from your phone.
- [ ] The owner receives the **🧾 New order** email within a minute.
- [ ] The customer email arrives (check spam the first time; mark it "Not spam").
- [ ] In `/admin`, the order appears, a toast pops up within 20s on an open admin tab, and marking it
      **Confirmed** sends the customer a confirmation email.
- [ ] Admin → **Email log** shows no failures.
- [ ] **Prep sheet** shows the order; **Print slips** prints cleanly.
- [ ] Cancel the test order (it frees capacity and is excluded from analytics).
- [ ] Share the link on WhatsApp/Instagram and check the preview card shows the logo and food image.

## Updating the site later

Push to `main` and Vercel redeploys automatically. Menu, prices, settings and copy that live in the
admin change instantly, with no deploy needed.

## Troubleshooting

| Symptom                                                    | Fix                                                                                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Site loads but menu says "couldn't load"                   | `MONGODB_URI` wrong, or Atlas Network Access missing `0.0.0.0/0`. Check Vercel → Deployments → Functions logs.                      |
| `Missing required environment variable JWT_SECRET` in logs | Add it in Vercel and redeploy.                                                                                                      |
| Emails in Email log show "domain is not verified"          | Finish Resend DNS verification, then press **Resend** on each failed email.                                                         |
| Admin login keeps returning to the login page              | The browser is blocking cookies (e.g. private mode with strict settings), or you're on plain `http://`. Use the `https://` address. |
| "Too many login attempts"                                  | 10 failed attempts per 15 minutes per network; wait 15 minutes.                                                                     |
