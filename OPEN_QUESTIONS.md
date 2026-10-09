# Open questions

Decisions still waiting on the owner (or the developer). Everything else is settled. Each item
has a sensible default that is live now; where it can be changed without code, the place is named.

## For the owner

1. **Approve the copy.** Hero headline is **"Ghana, boxed with love."** (alternatives: "Home, by the
   box." / "Cooked like Accra. Served in Worcester."), and the dish descriptions are drafts.
   _Headline: `src/content/site.ts`. Descriptions: Admin → Menu._
2. **Approve the photos.** Menu, hero and gallery photos are AI re-platings of the real photos in
   `reference/`; the real box photos appear under "What you'll receive" on each dish.
3. **Hajia Waakye: meat or fish?** Today there is only "Extra fish ($8)". If customers should choose,
   add a "Protein" choose-one group in Admin → Menu.
4. **Extras prices differ from the old flyer** (e.g. flyer "Banku, Plantain, Egg $5", website extra
   banku $5 / plantain $3 / eggs $2; flyer "Tilapia / chicken $18", website extra tilapia $15 /
   chicken $10). Update the flyer, or the prices in Admin → Menu.
5. **Ice Kenkey "With nuts"** is free. Should it carry an allergy note?
6. **Meals tax** isn't added; prices are treated as final. Check with an accountant whether the
   Massachusetts / Worcester meals tax applies.
7. **Capacity per pickup window** is unlimited. Set a maximum in Admin → Settings if the kitchen can
   only handle so many orders per slot.
8. **Uber couriers** add the courier's name in the order notes. Is a dedicated field wanted?
9. **Social links:** none are set, so no icons show. Add Instagram / TikTok / WhatsApp / Facebook in
   Admin → Settings → Business details when ready.
10. **Staff logins:** every admin has full access (orders, customers, marketing, settings). Is a
    helper account with fewer rights needed? Today, add one with `npm run admin:set`.

## For the developer

11. **Own domain and Resend.** Email goes through the owner's Gmail (~500/day, marketing capped at
    400). When a domain is bought, switch to Resend (DEPLOY.md §2b; env-only).
12. **Vercel plan.** Hobby is for non-commercial use; a business should be on Pro.
13. **Backups.** Atlas M0 has no automatic backups. Upgrade, or export orders/customers (CSV)
    regularly.
14. **Menu image uploads** are by URL. A Cloudinary upload button would make this easier for the
    owner (Vercel has no permanent disk).
15. **Continuing a paper order sequence?** Orders start at 233-0001. To continue from an existing
    number, set `counters` → `{ _id: "order", seq: <last number> }` in Atlas once, after
    `npm run prod:reset-test-data`.
16. **`react-router-dom` advisory (moderate)** is fixed only in v7 (a breaking upgrade). The app
    isn't affected (no server rendering; no user-controlled navigation targets), so it's left on v6.
    Upgrade when convenient.
