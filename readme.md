# E-Shop Demo — Premium Full-Stack E-Commerce Platform

A generic demo e-commerce portfolio project built with vanilla HTML, CSS, and JavaScript.

It is **not a real store**: products, prices, reviews and orders are sample data. Everything on the site is manageable from the admin panel without editing code.

## Demo Mode (default — no backend needed)

Supabase is **frozen**: the whole demo runs 100% on `localStorage` via `js/supabase/local-backend.js`, a Supabase-compatible emulator (same `from/rpc/auth` API, same tables, same RPC rules). Just serve the folder — no database, no keys, no network calls to Supabase:

```bash
npx serve .
```

Demo accounts (sign in on `login.html`, checkout, or the admin panel):

| Role | Email | Password |
|---|---|---|
| Admin (admin panel) | `admin@eshop.demo` | `Demo123!` |
| Shopper | `demo@eshop.demo` | `demo123` |

- New shoppers can **sign up** (stored locally); the **Google button** signs in a demo Google shopper instantly; **forgot password** resets to `demo1234`.
- Admin product edits, orders, coupons, settings, reviews, inventory and audit logs all persist in the browser.
- **Reset the demo:** run `LocalBackend.reset()` in the browser console (re-seeds products, users, orders, coupons, settings).
- **Switch back to live Supabase:** run `localStorage.eshop_backend = 'supabase'` in the console and reload (requires the Supabase setup below + network). Run `localStorage.removeItem('eshop_backend')` to return to demo mode.

> ⚠️ Demo auth is demo-grade (local password hashing, no email delivery) — fine for a portfolio demo, never for production user data.

## Supabase Setup (frozen — only needed if you switch back to live mode)

**Option A — one file (recommended):** open **SQL Editor** and run the whole **`all.sql`** bundle. It contains everything below in dependency order: base schema + RPCs + RLS + seeds, `stock-quantity`, `eshop-demo-setup` (categories, store profile, admin allow-list), `reviews`, `guest-checkout`, the 18-product demo catalog, and sample reviews.

**Option B — existing database:** if your tables already exist (e.g. this project's live DB), run only the standalone migration files you need, in order: `stock-quantity.sql`, `reviews.sql`, `guest-checkout.sql`, `eshop-demo-setup.sql`, `dynamic-store.sql`, optionally `products.sql` + `demo_reviews.sql`. (The base tables themselves live in section 1 of the bundle.)

**Premium v1 (new):** after either option, run **`premium-v1.sql`** once. It is additive + idempotent and adds brands, subcategories, SKU, product variants, inventory ledger, shipping zones, staff roles, audit logs, coupon engine v2 columns, SEO/marketing settings, secure RPCs (`validate_coupon`, `adjust_stock`, `set_order_status`, `admin_stats`) and tightened RLS (public read, admin/RPC write). Safe to re-run.

> ✅ **100% dynamic:** every storefront string is now admin-editable — shipping rates, currency, logo, footer/sidebar links, about page, chatbot messages and per-method payment logos. Run `dynamic-store.sql` once on an existing DB (fresh `all.sql` runs already include it).

> ⚠️ Pick **one** option. `products.sql` / `demo_reviews.sql` use plain `INSERT`s, so running them *after* the bundle duplicates seed rows.

Then:
1. Add your admin email — run `INSERT INTO public.admin_users (email) VALUES ('you@example.com') ON CONFLICT (email) DO NOTHING;` — or add it later in **Admin → Settings → Admin Access**.
2. Credentials resolve from `js/supabase/supabase-config.js` (loaded on every page, including admin). To use your own project without editing tracked files, create git-ignored `js/supabase/supabase.local.js` — see `js/supabase/supabase.local.example.js`.
3. In **Admin → Settings → Image Uploads**, paste an ImgBB API key (free at imgbb.com/api) to enable product/banner/review photo uploads.

> ⚠️ **Security note:** the `service_role` key bypasses RLS and must **never** be placed in client code or this repo. The `anon` key in `supabase-config.js` is public by design. Checkout totals are recomputed server-side by `create_order_secure` — prices, coupons and stock from the browser are never trusted.

## What Is Dynamic (Admin Panel, No Code Changes)

| Area | Source | Admin location |
|---|---|---|
| Products, prices, stock, images | `products` table | Products / Add Product |
| Categories | `categories` table (+ auto from products) | Settings → Categories |
| Featured products | `settings.flash_product_ids` | Settings → Flash Sale |
| Hero banners | `settings.hero_*` | Settings → Hero |
| Announcement marquee | `settings.marquee_*` | Settings → Marquee |
| Store name / tagline / footer | `settings.site_*` | Settings → Store Profile |
| Theme + header/footer colors | `settings.theme_*`, `header_footer_*` | Settings → Theme |
| Payment methods (bKash/Nagad/Rocket/COD…) | `payment_settings` | Payment Settings |
| Coupons | `coupons` | (via Supabase Table Editor) |
| Orders + statuses | `orders`, `order_items` | Orders |
| Messenger + social links | `settings.messenger_link`, `social_*` | Settings |
| Order mode (login/guest) | `settings.customer_order_mode` | Settings |
| Shipping threshold + fee | `settings.shipping_free_above`, `shipping_cost` | Settings → Shipping & Currency |
| Currency code + symbol | `settings.currency_code`, `currency_symbol` | Settings → Shipping & Currency |
| Logo (header/footer/favicon) | `settings.logo_url` | Settings → Logo & Branding |
| Footer + sidebar links | `settings.footer_links` (JSON) | Settings → Footer & Sidebar Links |
| About page content | `settings.about_content` (JSON) | Settings → About Page |
| Chatbot messages | `settings.chatbot_intro`, `chatbot_options` (JSON) | Settings → Chatbot Messages |
| Payment logos | `payment_settings.logo_url` | Payment Settings |
| Image upload key | `settings.imgbb_key` | Settings → Image Uploads |
| Admin allow-list | `admin_users` | Settings → Admin Access |

## Structure

```
eshop-demo/
├── index.html                 # Home page
├── product.html               # Product detail
├── checkout.html              # Checkout
├── my-orders.html             # Customer orders list
├── order-success.html         # Order confirmation
├── order-tracking.html        # Order tracking
├── about.html                 # About this demo
├── eshop-demo-setup.sql       # Demo setup: categories, profile, admins
│
├── admin/
│   ├── index.html             # Admin panel (login + dashboard)
│   ├── dashboard.html         # Dashboard page
│   ├── products.html          # Products list
│   ├── product-form.html      # Add / edit product
│   ├── orders.html            # Orders list
│   ├── reviews.html           # Custom Reviews
│   ├── activity.html          # Cart activity
│   ├── payments.html          # Payment settings
│   ├── settings.html          # Store profile, categories, theme, homepage
│   ├── admin.css              # Admin-only styles
│   └── js/
│       ├── admin-core.js      # Constants, state, auth + admin gate, uploads
│       ├── admin-settings.js  # All settings sections incl. store/categories
│       └── …                 # products, orders, reviews, dashboard modules
│
├── css/
│   ├── variables.css          # CSS custom properties, base resets
│   ├── base.css               # Typography, buttons, forms
│   ├── layout.css             # Header, nav, hero, footer
│   ├── components.css         # Cards, modals, sidebars
│   ├── pages.css              # Page-specific styles
│   └── responsive.css         # Media queries
│
├── js/
│   ├── core/
│   │   ├── config.js          # Storage keys (+ legacy key migration)
│   │   ├── site.js            # DB-driven store profile loader
│   │   ├── store-settings.js  # 100%-dynamic loader: shipping, currency, logo, footer, about, chatbot
│   │   ├── categories.js      # DB-driven categories loader/render
│   │   ├── imgbb.js           # Upload-key resolution (no hardcoded secret)
│   │   ├── utils.js           # formatPrice, stock helpers
│   │   ├── storage.js         # Cart local storage, pending actions
│   │   └── theme.js           # Dark/light toggle + site colors
│   │
│   ├── components/
│   │   ├── site-init.js       # Applies store profile + logo/footer/shipping cache on every page
│   │   ├── footer-links.js    # DB-driven footer + sidebar CONNECT links
│   │   └── …                 # toast, auth-modal, chatbot, footer-social
│   │
│   ├── supabase/
│   │   ├── supabase-config.js # Single credential source (+ local override)
│   │   └── client.js          # Supabase client (static HTML only)
│   │
│   └── pages/                 # home, collection, checkout, orders, …
│
└── assets/logo.svg            # Generic demo logo + favicon.svg
```

## Reviews

- **Product pages** show a **Product Reviews** section: average rating, per-star bars, reviewer list with photos and optional YouTube embeds.
- **Verified purchasing:** only a logged-in customer who owns a **delivered** order containing the product can write a review (enforced by `submit_customer_review` RPC + trigger).
- **Admin → Custom Reviews:** add/publish/hide/delete reviews and export CSV.
- Customers can only review a given product once.

## Key Decisions

- **No frameworks or build step.** Pure vanilla JS.
- **Fast loading:** critical CSS stays in the `<head>`; the rest loads asynchronously. A theme guard script runs before first paint; Supabase data is cached in localStorage.
- **`js/` modules** load as `<script type="module">` on public pages and plain `<script>` on admin.
- **No standalone `cart.js`.** Home, product detail, and checkout each handle cart internally per the original architecture.
- **`product-detail.js`** dynamically sets the page title to `{product} — E-Shop Demo`.

## Testing

```bash
# Syntax check all JS files
node --check js/core/*.js js/components/*.js js/supabase/*.js js/pages/*.js admin/js/*.js

# Serve locally and test in browser
npx serve .
```

## Tech Stack

| Layer    | Tool                        |
|----------|-----------------------------|
| Database | localStorage demo DB (Supabase-compatible emulator; live Supabase optional) |
| Hosting  | Static files only           |
| UI       | Vanilla HTML/CSS/JS         |
| Payments | bKash, Nagad, Rocket, COD   |
