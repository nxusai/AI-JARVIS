# Build instructions for Claude in Chrome: the Meta key for NXUS HQ (publish posts and run NXUS ads)

You are working in Eduardo's Meta Business settings (https://business.facebook.com/settings), in his own logged-in Chrome tab. Eduardo is watching. Goal: a **system user** of the NXUS AI business portfolio whose token lets NXUS HQ (a server) publish posts to the NXUS AI Facebook Page and Instagram account and create, pause and change the budget of ads in the **NXUS AI ad account only**.

## Ground rules
- **Never copy, type or read out a token, password or secret.** When the token appears, tell Eduardo to copy it himself and stop.
- **Do not touch Mi Semago, Abuelito or any other client's assets, ad accounts, pages, people or system users.** Do not remove anything. Do not change billing, payment methods or spending limits.
- If the account shows several business portfolios, ask Eduardo which one is **NXUS AI** before doing anything.
- Menu names may differ a little. If something doesn't match, stop and ask Eduardo (in Spanish). Report in Spanish after each part.

## Part 1 — Look first (change nothing)
In the NXUS AI business portfolio, list for Eduardo:
1. **Accounts → Pages**: the NXUS AI Facebook Page (name and ID).
2. **Accounts → Instagram accounts**: the NXUS AI Instagram account (username and ID), and whether it is connected to the Page.
3. **Accounts → Ad accounts**: the NXUS AI ad account (name and ID, `act_…`), its currency and time zone, and whether it has a payment method (yes/no only).
4. **Accounts → Apps**: the apps the portfolio owns (name and App ID). One may already exist from NEX's read-only key for Mi Semago.
5. **Users → System users**: the existing system users and their roles.
6. **Data sources → Datasets / Pixels**: any dataset or pixel for NXUS AI (name and ID).
Then ask Eduardo: which app to use (an existing one owned by the NXUS AI portfolio, or create a new one in Part 2).

## Part 2 — The app (only if Eduardo says to create one)
1. Open https://developers.facebook.com/apps → **Create app**.
2. Name: `NXUS HQ`. Use case: the option for **managing ads / Marketing API** (or "Other" → type **Business**). Business portfolio: **NXUS AI**.
3. Once created, add the **Marketing API** product if it is offered. Do not submit anything for App Review. Do not change the app mode.
4. Tell Eduardo the **App ID** (not the app secret).

## Part 3 — The system user
1. **Users → System users → Add**. Name: `NXUS HQ`. Role: **Employee** (not Admin).
2. **Assign assets** to it, only these, with these permissions:
   - The **NXUS AI ad account** → full control / manage campaigns (create, edit, pause, budgets; view performance).
   - The **NXUS AI Facebook Page** → full control / create content (so it can post).
   - The **NXUS AI Instagram account** → full control / create content.
   - The **app** from Part 1 or 2 → manage / develop app (so it can generate the token).
   - The NXUS AI **dataset/pixel**, if one exists → manage.
3. Show Eduardo the final list of assets of the `NXUS HQ` system user.

## Part 4 — The token (Eduardo copies it)
1. On the `NXUS HQ` system user, click **Generate new token** (or **Generate token**).
2. App: the one chosen in Part 1/2.
3. Expiration: **Never** if offered; if only 60 days is offered, choose it and tell Eduardo.
4. Permissions (check these, and only these that appear): `ads_management`, `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `read_insights`.
5. Click **Generate token**. **Stop and tell Eduardo:** "Copia el token ahora y pégalo en Netlify (proyecto nxus-hq) como META_TOKEN; Meta no lo vuelve a mostrar." Do not copy it yourself.

## Part 5 — Report
In Spanish, give Eduardo these IDs (they are not secrets) so he can paste them in Netlify:
- `META_AD_ACCOUNT_ID` = the NXUS AI ad account ID, with the `act_` prefix
- `META_PAGE_ID` = the NXUS AI Facebook Page ID
- `META_IG_ID` = the NXUS AI Instagram business account ID
- `META_DATASET_ID` = the dataset/pixel ID, if any
- the App ID used, the token expiration chosen, and anything that did not match these instructions.
