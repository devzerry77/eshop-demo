# Grabby Tech

An e-commerce site built with vanilla HTML, CSS, and JavaScript, backed by Supabase for database and authentication.

## Supabase Setup

1. Create a project, then open **SQL Editor** and run the whole **`all.sql`** file. It creates:
   - Tables: `products`, `orders`, `order_items`, `payment_settings`, `settings`, `coupons`, `addresses`
   - RPC functions: `decrement_stock(product_id, quantity)`, `increment_coupon_used(code)`
   - Indexes, grants, Row-Level-Security policies (wide-open for the client-side admin), and seed data.
2. If you keep `all.sql` from GitHub, add the two secrets by following step 3, then re-run.
3. Credentials live in two files (already set for project ref `arzzuvnuyrhfbqaiwily`):
   - `js/supabase/client.js` (public site)
   - `admin/js/admin-core.js` (admin panel, anon key)

> ⚠️ **Security note:** the `service_role` key bypasses RLS and must **never** be placed in client code or this repo. The wide-open `anon` policies deliberately mirror the existing client-side admin architecture; for production, move privileged operations to Supabase Edge Functions.

## Site Theme / Colors (Admin → Settings)

- Choose a preset — **Silver** (default), **Light**, **Dark** — or **Custom** (9 color fields).
- Click **Save Theme** to upsert `theme_*` rows in the `settings` table and write a `grabby_site_colors` localStorage cache.
- Public pages apply the palette via `<html data-chrome="silver|light|dark">` (presets) or inline CSS custom properties (custom), with a tiny inline `<head>` guard so there's no flash of the wrong theme.
- The `grabby_theme` key still controls the per-visitor dark/light toggle.

## Structure

```
grabbytech website/
├── index.html                 # Home page
├── product.html               # Product detail
├── checkout.html              # Checkout
├── my-orders.html             # Customer orders list
├── order-success.html         # Order confirmation
├── order-tracking.html        # Order tracking
├── about.html                 # About Us
│
├── admin/
│   ├── index.html             # Admin panel (login + full dashboard)
│   ├── admin.css              # Admin-only styles (includes marquee, orders, payments)
│   └── js/
│       ├── admin-core.js      # Constants, state, DOM, utils, theme, auth, lightbox
│       ├── admin-media.js     # Product sections, specs, media gallery (DNS: Drag-N-Sort)
│       ├── admin-products.js  # Product CRUD, render, pagination, form
│       ├── admin-orders.js    # Orders list, status updates, payment settings
│       ├── admin-dashboard.js # Stats, activity, AI assistant, renderAll
│       ├── admin-settings.js  # Site theme/colors + homepage marquee controls
│       └── admin-main.js      # Navigation (showSection), events, bootstrap
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
│   │   ├── config.js          # Currency config, caching, product loaders
│   │   ├── utils.js           # formatPrice, animateCounter, stock helpers
│   │   ├── storage.js         # Cart/Wishlist local storage, pending actions
│   │   └── theme.js           # Dark/light toggle + site colors (silver/light/dark/custom)
│   │
│   ├── components/
│   │   └── toast.js           # Toast notifications
│   │
│   ├── supabase/
│   │   └── client.js          # Supabase client (static HTML only)
│   │
│   └── pages/
│       ├── home.js            # Home page: hero, search, cart, modal, marquee
│       ├── product-detail.js  # Product detail: gallery, related, sections
│       ├── checkout.js        # Checkout: payment, login, coupon, orders
│       ├── orders.js          # My Orders page
│       ├── order-success.js   # Order confirmation
│       ├── order-tracking.js  # Order tracking timeline
│       ├── tracking.js        # Cart activity tracker (background)
│       ├── marquee.js         # Homepage marquee
│       └── about.js           # About page theme init
│
└── assets/logos/              # logo.png, etc.
```

## Key Decisions

- **No frameworks or build step.** Pure vanilla JS.
- **Fast loading:** critical CSS (`variables.css`, `base.css`) stays in the `<head>`; the rest loads asynchronously (`media="print"` swap). A FOUC-guard script applies theme + stored site colors before first paint.
- **`js/` modules** are loaded as `<script type="module">` on public pages and plain `<script>` on admin (with Supabase UMD loaded before them).
- **`admin.js` was split** into 7 focused modules sharing `window.admin` namespace.
- **`about.html`** is a real About Us page.
- **Admin panel is multi-page:** `admin/dashboard.html`, `products.html`, `product-form.html`, `orders.html`, `activity.html`, `payments.html`, `settings.html` — each loads its own data instead of one page showing/hiding sections. Shared logic lives in `admin/js/*` (core, media, products, orders, dashboard, settings) plus a per-page `page-*.js` bootstrap.
- **No standalone `cart.js` or `wishlist.js`.** Home, product detail, and checkout each handle cart/wishlist internally per the original architecture.
- **`product-detail.js`** dynamically sets the page title to `{product} — Grabby Tech`.

## Testing

```bash
# Syntax check all JS files
node --check js/core/*.js js/components/*.js js/supabase/*.js js/pages/*.js admin/js/*.js

# Serve locally and test in browser
npx serve .
```

## Tech Stack

| Layer    | Tool                                    |
|----------|-----------------------------------------|
| Database | Supabase (Postgres + Auth)             |
| Hosting  | Static files only                       |
| UI       | Vanilla HTML/CSS/JS                     |
| Payments | bKash, Nagad, Rocket, COD              |
| Language | Bengali (primary) / English             |
