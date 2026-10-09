# Open questions & defaults

Business details I didn't want to block on. Each has a sensible default that's live now, and most
can be changed in **Admin → Settings / Menu** without a code change. Where code is needed, the file
is named.

## Brand & copy

1. **Hero headline.** Live: **"Ghana, boxed with love."** Alternatives for the owner:
   - "Home, by the box."
   - "Cooked like Accra. Served in Worcester."

   _Change in `src/content/site.ts` → `headline`._

2. **Dish descriptions are drafts** and need the owner's approval. _Admin → Menu → edit._
3. **Ice Kenkey has no photo.** It uses a gold gradient placeholder card. The flyer shows bottled ice
   kenkey; a clean photo of it would replace the placeholder. _Admin → Menu → Image URL, or add it to
   `reference/` and run `npm run images`._
4. **`reference/rice.jpeg`** (rice, omelette, sausages, corned beef, sardine) isn't on the menu. It's
   used only in the gallery as "From our kitchen". Is it a dish to add, or should it be removed?
5. **Waakye photos:** the menu card uses the meat version and the gallery also shows the fish
   version. Should customers **choose meat or fish** for Hajia Waakye? Right now only "Extra fish ($8)"
   exists. A "Protein" choose-one group can be added in Admin → Menu.
6. **Social links** (Instagram, WhatsApp, TikTok, Facebook) are placeholders shown as "coming soon".
   _Admin → Settings → Business details._

## Menu & pricing

7. **Extras prices follow your spec, not the old flyer.** The flyer listed "Banku, Plantain, Egg $5"
   and "Tilapia / chicken $18". Live prices:

   | Item       | Extra               | Price |
   | ---------- | ------------------- | ----- |
   | Fried Rice | Extra sauce (shito) | $2    |
   | Fried Rice | Extra coleslaw      | $2    |
   | Fried Rice | Extra chicken       | $10   |
   | Fried Rice | Extra plantain      | $3    |
   | Banku      | Extra banku         | $5    |
   | Banku      | Extra tilapia       | $15   |
   | Banku      | Extra red sauce     | $2    |
   | Banku      | Extra shito         | $2    |
   | Waakye     | Extra eggs          | $2    |
   | Waakye     | Extra sauce         | $2    |
   | Waakye     | Extra fish          | $8    |
   | Waakye     | Extra plantain      | $3    |

   Please update the flyer, or change prices in Admin → Menu.

8. **Ice Kenkey "With nuts" is free**, as specified. Should there be an allergy note on it?
9. **Limits:** each extra is 0–5 per box, and each line is 1–20 boxes. _Code: `shared/menu.seed.ts`,
   `shared/pricing.ts`._
10. **Sales/meals tax isn't added.** Prices are treated as final. Massachusetts has a meals tax (and
    Worcester a local option), so the owner should check with an accountant whether it applies and
    whether prices should include it.

## Ordering & pickup

11. **Pickup address:** 25 Hollywood St, Worcester, MA 01610, shown in full on the website, in
    emails, the calendar file and the marketing-email footer (client request, Oct 2026). Editable
    in **Settings**; an existing database is updated with `npm run migrate:client-updates`.
12. **Pickup windows:** 12–2, 2–4, 4–6 and 6–8 PM, with **no capacity limit**. Set a max per window in
    Settings if the kitchen can only handle so many orders.
13. **Cutoff:** Monday 11:59 PM Eastern for Wednesday pickup. Customers can book **3 weeks ahead**.
    Both are in Settings.
14. **Order numbers start at 233-0001.** To continue an existing paper sequence, set the counter once
    in Atlas: `counters` collection, `{ _id: "order", seq: <last number> }`.
15. **Uber courier:** customers choose "I'll send an Uber courier" and can add the courier's name in
    the order notes. Do you want a dedicated field instead?
16. **Spam limits:** 8 orders per 15 minutes per network, 10 failed admin logins per 15 minutes.
    _Code: `server/middleware/rateLimit.ts`._

## Payments

17. **Payment text** (shown at checkout, on the confirmation page and in emails, but not in the hero or
    footer): _"No payment now. Once we confirm your order, pay via Zelle (amankwaherica98@gmail.com) or
    Apple Pay (508-353-8191), or pay at pickup."_ Editable in Settings.
18. **Payment status is set by hand** in the order drawer (Unpaid / Zelle / Apple Pay / Cash). There's
    no automatic payment matching.

## Emails

19. **New-order alerts** go to Settings → notification emails. The default is `OWNER_EMAIL`, falling
    back to the admin login email.
20. **Customers are emailed automatically** when an order becomes **Confirmed**, **Ready for pickup**
    or **Cancelled**. The admin can untick this per change and add a personal note. Adjust the defaults
    in Settings.
21. **Marketing sends** run inside one serverless request (60s limit), at about 5 emails at a time.
    That's fine for a few hundred customers. Past ~500 opted-in customers, move to Resend's batch API
    or a background queue.
22. **Sender address** depends on the domain you choose (e.g. `orders@233kitchen.com`). See DEPLOY.md.

## Admin

23. **Single admin account.** Should staff (e.g. a helper on Wednesdays) get their own logins?
24. **Analytics are by pickup date.** Revenue is an **estimate**, because orders are paid later.
    Cancelled orders are excluded. "Last 4 weeks" and "3 months" include already-booked upcoming
    pickups.
25. **Menu images** are set by URL for now. The image field is ready for a Cloudinary upload button
    later (Vercel has no permanent disk).

## Design

26. **Brand colours** are sampled from the logo: red `#C81010`, gold `#E1A10C`, green `#1E6131`,
    cream `#FCF7F1`, ink `#0B0B0B`. Gold isn't used for small text on white, because it fails contrast.
27. **Fonts:** Clash Display (Fontshare, free for commercial use) for headlines, Inter for body text.
    "kitchen" uses the logo artwork itself.
28. **Kente accents** are a lightweight CSS pattern in brand colours, not a photo of real kente.
    Swap in a photographic strip in `src/components/KenteBand.tsx` if preferred.
29. **3D icons:** drop PNGs into `public/icons/<name>.png` and list them in `THREE_D` in
    `src/components/BrandIcon.tsx`. The hero visual can be replaced via
    `src/components/hero/HeroVisual.tsx`.
