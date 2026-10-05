# Giftly Exchange

Giftly Exchange is a React web prototype for browsing gift cards and exploring sample buy, sell, marketplace, auction, wallet, verification, escrow, and delivery workflows. It uses Vite for development and Supabase for selected account and catalog data.

> **Prototype only:** Checkout, payments, wallet balances, payouts, gift-card checks, identity and phone verification, risk indicators, escrow, email/SMS, and delivery are simulated. Do not enter real payment credentials, gift-card numbers or PINs, identity documents, or other sensitive information. The app is not a production financial or verification service.

## Run locally

Prerequisites: Node.js and npm.

```sh
npm install
npm run dev
```

Vite prints the local URL when the development server starts. Other useful commands:

```sh
npm run build      # Create a production build in dist/
npm run preview    # Serve the production build locally
npm run lint       # Run ESLint
```

There is currently no test script or dedicated test directory in `package.json` / `src/`.

## Supabase configuration

Create a `.env.local` file in the project root for the Supabase project used by this app:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

The frontend reads these values in `src/lib/supabase.js`. Use only a Supabase publishable/anon key in browser code; never put a service-role key or other secret in a `VITE_` variable. Supabase email magic-link authentication, the public gift-card catalog, and gift-card verification history require a configured project and the corresponding database schema.

Apply the SQL files in this order from the Supabase SQL editor or your migration workflow:

1. `supabase/migrations/20260930_profiles_roles_rls.sql` creates user profiles, role helpers, an auth-user trigger, and profile row-level security policies.
2. `supabase/migrations/20260930_gift_cards_catalog_inventory.sql` creates catalog, inventory, and verification tables, indexes, triggers, and row-level security policies.
3. Optionally run `supabase/seed/demo_catalog.sql` to add sample categories, brands, and gift cards. This is demo content and is not run automatically.

## How the code is organized

- `src/main.jsx` loads the global styles and mounts the React app.
- `src/App.jsx` contains the storefront and top-level route definitions, customer/admin route guards, shared navigation, and the major shopping pages.
- `src/contexts.jsx` provides authentication, cart, wishlist, and wallet state to the component tree.
- `src/services/` contains catalog access and the local prototype services for wallet, trading, escrow, notifications, delivery, and gift-card checks.
- `src/lib/supabase.js` creates the Supabase client. `src/services/catalogService.js` and `src/services/giftCardVerificationService.js` use it for selected data flows.
- `supabase/` holds the database migrations and optional sample catalog seed.

### Main routes

- Storefront: `/`, `/gift-cards`, `/categories/:category`, `/gift-cards/:id`, `/offers`.
- Marketplace and auctions: `/marketplace`, `/marketplace/:listingId`, `/auctions`, `/auctions/:auctionId`.
- Customer account: `/dashboard`, `/profile`, `/orders`, `/wallet`, `/verification`, `/gift-card-verification`, `/my-listings`, `/my-bids`, `/my-escrows`, `/deliveries`, and `/notifications`.
- Admin workspace: `/admin` plus catalog, user, order, verification, trading, escrow, dispute, delivery, wallet, notification, fraud, and settings pages under `/admin/...`.
- Product information: `/how-it-works`, `/terms`, `/privacy`, `/compliance`, and `/security`.

Customer and admin pages are gated in the React router. Those client-side checks are for the prototype experience; they are not a replacement for server-side authorization or database policies.

## Data and prototype boundaries

- Supabase Auth provides email magic-link sign-in. The app loads the signed-in user's profile and role from `profiles`.
- The public catalog is read from Supabase `gift_card_categories`, `gift_cards`, and related brand records. `src/data.js` also contains fallback/demo product and offer data used by prototype flows.
- Gift-card verification uses mock OCR, detail matching, balance, and risk results from `src/services/giftCardVerification.js`. The workflow submits masked metadata to Supabase and reads saved history from `gift_card_verifications`; the mock result is not a retailer verification.
- Cart, wishlist, orders, local admin records, wallet ledger, trading, escrow, disputes, delivery records, and notifications are primarily stored in this browser's `localStorage`. Some upload previews and dispute evidence exist only in memory for the current browser session.
- Clearing browser storage can remove prototype data. Local browser storage is not a secure database, trusted role system, or financial ledger.

## Folder and file guide

### Project root

- `index.html` — Vite's HTML entry point, page title, favicon reference, and React mount element.
- `package.json` — Project dependencies and `dev`, `build`, `preview`, and `lint` scripts.
- `package-lock.json` — npm's generated dependency lockfile for reproducible installs.
- `vite.config.js` — Enables the Vite React plugin.
- `eslint.config.js` — ESLint rules for JavaScript, React Hooks, and Vite React refresh.
- `.gitignore` — Excludes dependencies, build output, local environment files, logs, and editor files from Git.
- `README.md` — Project setup, architecture, file map, and prototype notes (this document).

### `public/`

Static files served from the site root without being imported through JavaScript.

- `favicon.svg` — Browser tab icon referenced by `index.html`.
- `icons.svg` — SVG symbol collection available as a static asset.

### `src/` application entry, shared state, and data

- `main.jsx` — Mounts `<App />` in React strict mode and imports the global stylesheets.
- `App.jsx` — Storefront layout, catalog and cart pages, login, account dashboard, route guards, admin layout, and all public/customer/admin route registrations.
- `contexts.jsx` — React providers and hooks for Supabase authentication/profile state, local cart and wishlist, gift-card verification records, and wallet actions.
- `data.js` — Sample catalog categories, gift cards, offers, sample orders/exchanges, and INR formatting helper.
- `index.css` — Font imports, global reset, and base document styles.
- `App.css` — Main design system and shared storefront, forms, tables, account, and admin styles, including responsive rules.
- `AppShell.css` — Additional storefront, product, dashboard, and admin-shell layout refinements.

### `src/` page modules

Each page module contains React components for a product area. Where a matching stylesheet exists, it supplies that area's page-specific layout and styles.

- `AdminDeliveries.jsx` / `AdminDeliveries.css` — Admin delivery queue, filters, masked delivery details, channel status, and cancellation action.
- `AdminManagement.jsx` / `AdminManagement.css` — Admin catalog/category/order/user/exchange/offer/settings screens, local record editing, and the prototype fraud review page.
- `AdminWallet.jsx` / `AdminWallet.css` — Admin wallet overview, simulated ledger, currency totals, and cash-out review actions.
- `Deliveries.jsx` / `Deliveries.css` — Customer list of delivery records associated with their prototype transactions.
- `Delivery.jsx` / `Delivery.css` — Single delivery status, simulated notification channels, timeline, and buyer-only masked delivery reveal.
- `Escrow.jsx` / `Escrow.css` — Customer/admin escrow dashboards, transaction detail, buyer confirmation, dispute reporting/review, and escrow activity.
- `GiftCardVerification.jsx` / `GiftCardVerification.css` — Multi-step gift-card verification demo, upload previews, masked result/history, and admin review queue.
- `GlobalPreferences.jsx` / `GlobalPreferences.css` — Country and preferred-currency selectors used in the storefront navigation.
- `LegalPages.jsx` / `LegalPages.css` — Prototype terms, privacy, compliance, security, and how-it-works information pages.
- `Notifications.jsx` / `Notifications.css` — Customer notification inbox and admin notification management, including read/delete filters.
- `Operations.jsx` / `Operations.css` — Admin operations dashboard with local metrics, recent activity, and review shortcuts.
- `Trading.jsx` / `Trading.css` — Selling-method selection, simulated cash-out, P2P listing and auction creation, marketplace browsing, and listing details.
- `TradingPages.jsx` — Auction browsing/detail, bids, customer listings and transaction history, and admin trading review. It shares `Trading.css` with `Trading.jsx`.
- `Verification.jsx` / `Verification.css` — Mock phone and identity verification journey and admin identity review queue.
- `Wallet.jsx` / `Wallet.css` — Customer wallet overview, simulated deposits/withdrawals/conversions, and transaction history/detail.

### `src/lib/`

- `supabase.js` — Initializes and exports the Supabase JavaScript client from the Vite environment variables.

### `src/services/`

Service modules keep data access and prototype business rules out of most page components. Many services intentionally use browser storage rather than a production API.

- `adminPrototypeService.js` — Reads/writes local admin collections and composes admin operation metrics and recent activity.
- `api.js` — Small async facade for catalog, offers, local orders/exchanges, and sample exchange requests.
- `catalogService.js` — Fetches active categories/cards from Supabase and maps database rows to the storefront catalog model.
- `countryData.js` — Supported country, phone-code, currency, and region options plus preference helpers.
- `deliveryService.js` — Creates and updates local delivery records and simulates in-app, email, and SMS channel statuses.
- `escrowService.js` — Local prototype escrow/dispute state transitions and linked simulated transaction records.
- `giftCardVerification.js` — Simulated image scan/OCR, card-detail check, balance lookup, risk scoring, and masking helpers.
- `giftCardVerificationService.js` — Inserts masked verification submissions and retrieves the signed-in user's verification history from Supabase.
- `notificationService.js` — Local notification creation, access checks, unread counts, read state, and deletion.
- `tradingService.js` — Local P2P listings, auctions, bids, cash-outs, transaction records, and associated escrow creation.
- `walletService.js` — Local multi-currency wallet ledger, fixed demo exchange rates, and simulated deposits, withdrawals, and conversions.

### `src/assets/`

- `hero.png` — Storefront hero artwork imported by `App.jsx`.
- `react.svg` and `vite.svg` — Starter assets retained in the source tree; the app does not currently import them.

### `supabase/`

- `migrations/20260930_profiles_roles_rls.sql` — Profile table, user-created trigger, role helper, and profile access policies.
- `migrations/20260930_gift_cards_catalog_inventory.sql` — Gift-card catalog, inventory, and verification schema; indexes, update/security triggers, and row-level security policies.
- `seed/demo_catalog.sql` — Optional idempotent demo categories, brands, and catalog products for local prototype testing.

## Dependencies

The app uses React 19, React DOM, React Router, Supabase JS, and Lucide React icons. Vite and ESLint are the development/build tools. See `package.json` for the exact dependency versions/ranges.
