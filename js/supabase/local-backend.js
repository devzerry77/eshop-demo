/* ═══════════════════════════════════════════════════════════════
   E-SHOP DEMO — LOCAL BACKEND (demo mode, Supabase frozen)
   ─────────────────────────────────────────────────────────────
   A localStorage-backed, Supabase-compatible data layer that mirrors
   the tables + RPCs used by this demo (see all.sql / premium-v1.sql).

   * Classic script, zero dependencies. Exposes window.LocalBackend.
   * When active, js/supabase/client.js returns this emulator instead
     of a network client, so EVERY existing call site
     (from/select/insert/update/upsert/delete/eq/in/ilike/order/limit/
     single/maybeSingle/rpc/auth.*) keeps working with NO edits.
   * Supabase files + SQL are left untouched ("frozen"). To switch the
     live project back to Supabase: localStorage.eshop_backend = 'supabase'
   * Demo login (local only, demo-grade password hashing — NOT for
     production secrets):
         admin:    admin@eshop.demo / Demo123!   (admin panel access)
         customer: demo@eshop.demo  / demo123    (shopper account)
   * Reset everything: LocalBackend.reset() in the browser console.
   ═══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var DB_KEY = 'eshop_localdb_v1';
    var SESSION_KEY = 'eshop_local_session';
    var MODE_KEY = 'eshop_backend'; // 'local' (default) | 'supabase'

    function useLocal() {
        try {
            var m = localStorage.getItem(MODE_KEY);
            return m !== 'supabase'; // local unless explicitly switched back
        } catch (_) { return true; }
    }

    function nowISO() { return new Date().toISOString(); }
    function daysFromNow(n) { return new Date(Date.now() + n * 86400000).toISOString(); }

    // Demo-grade password hash (djb2 + salt, iterated). This is a *demo*:
    // it only stops casual localStorage snooping — never use for real auth.
    function hashPw(pw, salt) {
        var h1 = 5381, h2 = 52711;
        var s = 'eshop-demo$' + salt + '$' + String(pw);
        for (var r = 0; r < 3; r++) {
            for (var i = 0; i < s.length; i++) {
                var c = s.charCodeAt(i);
                h1 = ((h1 << 5) + h1 + c) | 0;
                h2 = ((h2 << 7) + h2 + c) | 0;
            }
            s = '' + h1 + ':' + h2 + ':' + s.length;
        }
        return 'd2$' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
    }

    function uid(prefix) {
        return (prefix || 'u') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    /* ─── SEEDS ─────────────────────────────────────────────── */
    function seedProducts() {
        var P = [
            [1, 'High-Pressure Foam Spray', 'lifestyle', 1787, null, 4.2, 23, 'Professional foam sprayer with adjustable nozzle and 2L capacity.', { Capacity: '2L', Pressure: '3.5 bar' }, false, 0, 'Sold out', 'foam'],
            [2, 'Portable Hookah Go', 'lifestyle', 3997, null, 4.4, 45, 'Compact travel hookah with premium glass construction.', { Height: '25cm', Material: 'Glass' }, true, 50, null, 'hookah'],
            [3, 'Magnetic Accessory Disc', 'accessories', 450, null, 3.8, 12, 'Universal magnetic mount with N52 neodymium magnets.', { Diameter: '48mm', Magnet: 'N52' }, false, 0, 'Sold out', 'magnet'],
            [4, 'Wireless Charging Hub', 'electronics', 2450, 3200, 4.9, 67, '3-in-1 wireless charger for phone, watch, and earbuds.', { Output: '15W', Coils: '3' }, true, 50, 'Sale', 'charger'],
            [5, 'Noise Cancelling Buds', 'audio', 1250, null, 4.6, 89, 'ANC earbuds with 6h battery and crystal clear sound.', { Battery: '6h', Driver: '10mm' }, true, 50, null, 'buds'],
            [6, 'USB-C Multi Hub', 'accessories', 890, null, 4.3, 34, '7-in-1 USB-C hub with HDMI 4K and SD card reader.', { Ports: '7', HDMI: '4K' }, false, 0, 'Sold out', 'hub'],
            [7, 'Smart Watch Pro', 'wearables', 4999, 5999, 4.8, 120, 'AMOLED smartwatch with 7-day battery and health tracking.', { Display: '1.43"', Battery: '7 days' }, true, 50, 'Sale', 'watch'],
            [8, 'Gaming Mouse X', 'gaming', 4599, null, 4.5, 56, 'Ultralight gaming mouse with PAW3395 sensor.', { Sensor: 'PAW3395', Weight: '58g' }, true, 50, null, 'mouse'],
            [9, 'Mechanical Keyboard', 'gaming', 8999, 10999, 4.9, 78, 'Hot-swappable TKL keyboard with Gateron Yellow switches.', { Switches: 'Gateron Yellow', Layout: 'TKL' }, true, 50, 'Sale', 'keyboard'],
            [10, '4K Action Camera', 'camera', 19999, null, 4.7, 43, '4K60 action camera with EIS 2.0 stabilization.', { Video: '4K60fps', Stabilization: 'EIS 2.0' }, true, 50, null, 'camera'],
            [11, 'Bluetooth Speaker', 'audio', 6999, 8999, 4.4, 92, 'Portable 360° speaker with 20h battery and 30W output.', { Battery: '20h', Output: '30W' }, true, 50, 'Sale', 'speaker'],
            [12, 'Solar Power Bank', 'accessories', 3999, null, 4.2, 38, '20000mAh solar power bank with 2W solar panel.', { Capacity: '20000mAh', Solar: '2W' }, true, 50, null, 'solar']
        ];
        return P.map(function (r, i) {
            var img = 'https://picsum.photos/seed/' + r[12] + '/400/400';
            return {
                id: r[0], title: r[1], category: r[2],
                price: r[3], original_price: r[4], rating: r[5], reviews: r[6],
                description: r[7], image: img, images: [img], badge: r[11],
                in_stock: r[9], stock_quantity: r[10],
                specs: r[8], details: {},
                sku: 'ESH-' + String(r[0]).padStart(6, '0'),
                brand_id: null, low_stock_threshold: 5,
                is_featured: [4, 7, 9, 11].indexOf(r[0]) > -1,
                is_flash: [4, 7].indexOf(r[0]) > -1,
                created_at: new Date(Date.now() - i * 86400000).toISOString()
            };
        });
    }

    function seedSettings() {
        var footerLinks = JSON.stringify({ policies: [], about: [], connect: [] });
        var about = JSON.stringify({});
        var rows = [
            ['site_name', 'E-Shop Demo'],
            ['site_tagline', 'Quality demo products for everyday life.'],
            ['footer_note', '© 2026 E-Shop Demo · Demo portfolio project — no real orders are fulfilled.'],
            ['customer_order_mode', 'login'],
            ['shipping_free_above', '2000'],
            ['shipping_cost', '100'],
            ['currency_code', 'BDT'],
            ['currency_symbol', '৳'],
            ['logo_url', 'assets/logo.svg'],
            ['footer_links', footerLinks],
            ['about_content', about],
            ['chatbot_intro', '[]'],
            ['chatbot_options', '[]'],
            ['marquee_text', '🚚 Demo delivery on all orders • 🎁 Demo gift wrapping • ↩️ 7-day easy return • 🔒 Secure checkout'],
            ['marquee_enabled', 'true'],
            ['marquee_glow', 'true'],
            ['marquee_glow_color', '#ff6b6b'],
            ['marquee_glow_intensity', '20'],
            ['marquee_border_glow', 'true'],
            ['marquee_border_color', '#667eea'],
            ['marquee_speed', '20'],
            ['marquee_bg_color', '#0a0a0a'],
            ['marquee_text_color', '#ffffff'],
            ['hero_enabled', 'true'],
            ['hero_title', ''],
            ['hero_autoplay_ms', '2600'],
            ['hero_slides', '[]'],
            ['flash_enabled', 'true'],
            ['flash_title', 'Flash Sale'],
            ['flash_subtitle', 'Deals of the day — grab them before they are gone'],
            ['flash_badge', 'Hot'],
            ['flash_product_ids', ''],
            ['flash_autoplay_ms', '2600'],
            ['flash_per_view', '5'],
            ['flash_accent', '#ff5000'],
            ['flash_duration_minutes', '120'],
            ['theme_preset', 'silver'],
            ['header_footer_bg_light', '#000000'],
            ['header_footer_bg_dark', '#000000'],
            ['messenger_link', ''],
            ['social_facebook', ''],
            ['social_instagram', ''],
            ['social_youtube', ''],
            ['social_tiktok', ''],
            ['social_x', ''],
            ['contact_whatsapp', ''],
            ['contact_facebook', ''],
            ['imgbb_key', '']
        ];
        return rows.map(function (r) { return { key: r[0], value: r[1] }; });
    }

    function seedDB() {
        return {
            seq: { products: 100, orders: 1000, order_items: 10000, addresses: 100, payment_settings: 100, reviews: 100, inventory_ledger: 1000, audit_logs: 10000, coupon_redemptions: 1000, brands: 100, categories: 100 },
            users: [
                { id: 'u_admin', email: 'admin@eshop.demo', pw: hashPw('Demo123!', 'admin@eshop.demo'), name: 'Store Admin', role: 'admin', created_at: nowISO() },
                { id: 'u_demo', email: 'demo@eshop.demo', pw: hashPw('demo123', 'demo@eshop.demo'), name: 'Demo Customer', role: 'customer', created_at: nowISO() }
            ],
            products: seedProducts(),
            categories: [
                { slug: 'audio', label: 'Audio', sort_order: 1, active: true },
                { slug: 'electronics', label: 'Electronics', sort_order: 2, active: true },
                { slug: 'gaming', label: 'Gaming', sort_order: 3, active: true },
                { slug: 'wearables', label: 'Wearables', sort_order: 4, active: true },
                { slug: 'accessories', label: 'Accessories', sort_order: 5, active: true },
                { slug: 'camera', label: 'Camera', sort_order: 6, active: true },
                { slug: 'lifestyle', label: 'Lifestyle', sort_order: 7, active: true }
            ],
            brands: [
                { id: 1, name: 'DemoBrand', slug: 'demobrand', active: true }
            ],
            coupons: [
                { code: 'DEMO10', active: true, valid_from: daysFromNow(-1), valid_to: daysFromNow(365), usage_limit: null, used_count: 0, min_order_amount: 0, discount_type: 'percentage', discount_value: 10, max_discount: null, per_user_limit: null, campaign: '' },
                { code: 'FLAT50', active: true, valid_from: daysFromNow(-1), valid_to: daysFromNow(365), usage_limit: null, used_count: 0, min_order_amount: 500, discount_type: 'fixed', discount_value: 50, max_discount: null, per_user_limit: null, campaign: '' }
            ],
            coupon_redemptions: [],
            payment_settings: [
                { id: 1, method_name: 'bKash', enabled: true, status: 'available', fee: 0, account_info: { type: 'mobile', number: '01XXXXXXXXX' }, instructions: 'Send money to the bKash number above, then enter your TrxID on the tracking page.', qr_code_url: '', logo_url: '', display_order: 1 },
                { id: 2, method_name: 'Nagad', enabled: true, status: 'available', fee: 0, account_info: { type: 'mobile', number: '01XXXXXXXXX' }, instructions: 'Send money to the Nagad number above, then enter your TrxID on the tracking page.', qr_code_url: '', logo_url: '', display_order: 2 },
                { id: 3, method_name: 'Rocket', enabled: true, status: 'available', fee: 0, account_info: { type: 'mobile', number: '01XXXXXXXXX' }, instructions: 'Send money to the Rocket number above, then enter your TrxID on the tracking page.', qr_code_url: '', logo_url: '', display_order: 3 },
                { id: 4, method_name: 'Cash on Delivery', enabled: true, status: 'available', fee: 0, account_info: { type: 'cod' }, instructions: 'Pay in cash when your order arrives.', qr_code_url: '', logo_url: '', display_order: 4 }
            ],
            settings: seedSettings(),
            orders: [],
            order_items: [],
            addresses: [],
            reviews: [
                { id: 'rev-seed-1', product_id: 4, user_id: null, reviewer_name: 'Tanvir H.', rating: 5, review_text: 'Charges all my devices at once. Genuine demo review.', images: [], video_url: null, source: 'admin', is_published: true, created_at: daysFromNow(-12) },
                { id: 'rev-seed-2', product_id: 7, user_id: null, reviewer_name: 'Nusrat J.', rating: 5, review_text: 'Battery easily lasts a full week. Display is gorgeous.', images: [], video_url: null, source: 'admin', is_published: true, created_at: daysFromNow(-9) },
                { id: 'rev-seed-3', product_id: 9, user_id: null, reviewer_name: 'Arif R.', rating: 4, review_text: 'Great typing feel for the price. Demo review sample.', images: [], video_url: null, source: 'admin', is_published: true, created_at: daysFromNow(-4) }
            ],
            admin_users: [{ email: 'admin@eshop.demo', created_at: nowISO() }],
            admin_roles: [{ email: 'admin@eshop.demo', role: 'super_admin', permissions: { all: true }, created_at: nowISO() }],
            audit_logs: [],
            shipping_zones: [
                { id: 1, name: 'Inside Dhaka', districts: ['Dhaka'], fee: 60, free_above: 2000, eta_days: '1-2 days', courier_hint: 'standard', active: true, created_at: nowISO() },
                { id: 2, name: 'Outside Dhaka', districts: ['Chattogram', 'Sylhet', 'Khulna', 'Rajshahi', 'Barishal', 'Rangpur', 'Mymensingh'], fee: 120, free_above: 3000, eta_days: '2-4 days', courier_hint: 'standard', active: true, created_at: nowISO() },
                { id: 3, name: 'Nationwide Default', districts: [], fee: 100, free_above: 2000, eta_days: '2-5 days', courier_hint: 'standard', active: true, created_at: nowISO() }
            ],
            inventory_ledger: []
        };
    }

    /* ─── PERSISTENCE ───────────────────────────────────────── */
    function loadDB() {
        try {
            var raw = localStorage.getItem(DB_KEY);
            if (raw) {
                var db = JSON.parse(raw);
                if (db && db.products && db.users && db.settings) return db;
            }
        } catch (_) { /* corrupted → reseed below */ }
        var fresh = seedDB();
        // Preserve products a visitor may already have (e.g. synced from
        // Supabase before the freeze, or edited in a previous session).
        try {
            var cached = localStorage.getItem('eshop_products');
            if (cached) {
                var arr = JSON.parse(cached);
                if (Array.isArray(arr) && arr.length) {
                    fresh.products = arr.map(function (p, i) {
                        return {
                            id: (p.id === undefined || p.id === null) ? (i + 1) : p.id,
                            title: p.title || 'Untitled', category: p.category || 'lifestyle',
                            price: Number(p.price) || 0, original_price: (p.originalPrice === undefined || p.originalPrice === null) ? null : Number(p.originalPrice),
                            rating: Number(p.rating) || 0, reviews: parseInt(p.reviews, 10) || 0,
                            description: p.description || '', image: p.image || '', images: p.images || (p.image ? [p.image] : []),
                            badge: p.badge || null, in_stock: p.inStock !== false,
                            stock_quantity: (p.stockQty === undefined || p.stockQty === null) ? 50 : p.stockQty,
                            specs: p.specs || {}, details: p.details || {},
                            sku: p.sku || ('ESH-' + String(p.id).padStart(6, '0')),
                            brand_id: p.brandId || null, low_stock_threshold: 5,
                            is_featured: !!p.isFeatured, is_flash: !!p.isFlash,
                            created_at: nowISO()
                        };
                    });
                }
            }
        } catch (_) { /* keep seeds */ }
        saveDB(fresh);
        return fresh;
    }

    var DB = null;
    function db() { if (!DB) DB = loadDB(); return DB; }
    function saveDB(next) { DB = next || DB; try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (_) { /* quota → keep memory copy */ } }

    function nextId(table) {
        var d = db();
        d.seq[table] = (d.seq[table] || 1000) + 1;
        saveDB(d);
        return d.seq[table];
    }

    /* ─── SESSION ───────────────────────────────────────────── */
    function getSessionUserId() {
        try { return localStorage.getItem(SESSION_KEY) || null; } catch (_) { return null; }
    }
    function setSessionUserId(id) {
        try {
            if (id) localStorage.setItem(SESSION_KEY, id);
            else localStorage.removeItem(SESSION_KEY);
        } catch (_) {}
    }
    function publicUser(u) {
        if (!u) return null;
        return { id: u.id, email: u.email, user_metadata: { full_name: u.name || '' }, created_at: u.created_at || nowISO() };
    }
    function currentUser() {
        var id = getSessionUserId();
        if (!id) return null;
        var u = db().users.find(function (x) { return x.id === id; });
        return u || null;
    }

    /* ─── QUERY BUILDER ─────────────────────────────────────── */
    function pickCols(row, cols) {
        if (!cols || cols === '*') return clone(row);
        var out = {};
        String(cols).split(',').map(function (c) { return c.trim(); }).filter(Boolean).forEach(function (c) {
            out[c] = row[c];
        });
        return out;
    }

    function matchLike(value, pattern) {
        // Supabase ilike: % wildcards, case-insensitive.
        var esc = String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        var re = new RegExp('^' + esc.split('%').join('.*') + '$', 'i');
        return re.test(String(value === undefined || value === null ? '' : value));
    }

    function naturalKey(table) {
        return { settings: 'key', coupons: 'code', categories: 'slug', admin_users: 'email', admin_roles: 'email' }[table] || null;
    }

    function Builder(table, op, payload, opts) {
        this.table = table;
        this.op = op; // select|insert|update|upsert|delete
        this.payload = payload;
        this.opts = opts || {};
        this.filters = [];
        this.orders = [];
        this.limitN = null;
        this.returnCols = (op === 'select') ? (payload || '*') : '*';
        this.singleMode = null; // null | 'single' | 'maybe'
    }
    Builder.prototype.eq = function (col, val) { this.filters.push({ t: 'eq', col: col, val: val }); return this; };
    Builder.prototype.in = function (col, vals) { this.filters.push({ t: 'in', col: col, val: vals }); return this; };
    Builder.prototype.ilike = function (col, pattern) { this.filters.push({ t: 'ilike', col: col, val: pattern }); return this; };
    Builder.prototype.order = function (col, opt) {
        this.orders.push({ col: col, asc: !(opt && opt.ascending === false) });
        return this;
    };
    Builder.prototype.limit = function (n) { this.limitN = n; return this; };
    Builder.prototype.select = function (cols) { this.returnCols = cols || '*'; return this; };
    Builder.prototype.single = function () { this.singleMode = 'single'; return this.exec(); };
    Builder.prototype.maybeSingle = function () { this.singleMode = 'maybe'; return this.exec(); };
    Builder.prototype.then = function (resolve, reject) { return this.exec().then(resolve, reject); };

    Builder.prototype.applyFilters = function (rows) {
        var self = this;
        var out = rows.filter(function (r) {
            return self.filters.every(function (f) {
                var v = r[f.col];
                if (f.t === 'eq') return String(v === undefined || v === null ? '' : v) === String(f.val === undefined || f.val === null ? '' : f.val) || v === f.val;
                if (f.t === 'in') return Array.isArray(f.val) && f.val.some(function (x) { return String(x) === String(v); });
                if (f.t === 'ilike') return matchLike(v, f.val);
                return true;
            });
        });
        if (self.orders.length) {
            out = out.slice().sort(function (a, b) {
                for (var i = 0; i < self.orders.length; i++) {
                    var o = self.orders[i];
                    var av = a[o.col], bv = b[o.col];
                    if (av === bv) continue;
                    if (av === null || av === undefined) return o.asc ? 1 : -1;
                    if (bv === null || bv === undefined) return o.asc ? -1 : 1;
                    if (av < bv) return o.asc ? -1 : 1;
                    if (av > bv) return o.asc ? 1 : -1;
                }
                return 0;
            });
        }
        if (self.limitN !== null && self.limitN !== undefined) out = out.slice(0, self.limitN);
        return out;
    };

    Builder.prototype.exec = function () {
        var self = this;
        return new Promise(function (resolve) {
            setTimeout(function () {
                try { resolve(self.run()); }
                catch (e) { resolve({ data: null, error: { message: (e && e.message) || 'Local query failed', code: 'LOCAL_ERROR' } }); }
            }, 0);
        });
    };

    function autoId(table, row) {
        var d = db();
        if (table === 'reviews' && (row.id === undefined || row.id === null)) return 'rev-' + nextId('reviews');
        if (row.id === undefined || row.id === null) {
            if (['products', 'orders', 'order_items', 'addresses', 'payment_settings', 'brands', 'shipping_zones', 'inventory_ledger', 'audit_logs', 'coupon_redemptions'].indexOf(table) > -1) {
                return nextId(table);
            }
        }
        return row.id;
    }

    Builder.prototype.run = function () {
        var d = db();
        var table = this.table;
        if (!d[table]) d[table] = [];
        var rows = d[table];

        if (this.op === 'select') {
            var self = this;
            var found = this.applyFilters(rows).map(function (r) { return pickCols(r, self.returnCols); });
            if (this.singleMode === 'single') {
                if (!found.length) return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
                return { data: found[0], error: null };
            }
            if (this.singleMode === 'maybe') return { data: found[0] || null, error: null };
            return { data: found, error: null };
        }

        if (this.op === 'insert') {
            var list = Array.isArray(this.payload) ? this.payload : [this.payload];
            var inserted = list.map(function (r) {
                var row = clone(r || {});
                row.id = autoId(table, row);
                if (!row.created_at && table !== 'settings') row.created_at = nowISO();
                rows.push(row);
                return row;
            });
            saveDB(d);
            var ret = inserted.map(function (r) { return pickCols(r, this.returnCols); }.bind(this));
            if (this.singleMode === 'single') {
                if (!ret.length) return { data: null, error: { message: 'Insert failed', code: 'LOCAL_ERROR' } };
                return { data: ret[0], error: null };
            }
            if (this.singleMode === 'maybe') return { data: ret[0] || null, error: null };
            return { data: ret, error: null };
        }

        if (this.op === 'update') {
            var matched = this.applyFilters(rows);
            var patch = this.payload || {};
            matched.forEach(function (r) {
                Object.keys(patch).forEach(function (k) { r[k] = clone(patch[k]); });
                r.updated_at = nowISO();
            });
            saveDB(d);
            return { data: matched.map(function (r) { return pickCols(r, this.returnCols); }.bind(this)), error: null };
        }

        if (this.op === 'upsert') {
            var items = Array.isArray(this.payload) ? this.payload : [this.payload];
            var conflict = (this.opts && this.opts.onConflict) || naturalKey(table);
            var out = items.map(function (incoming) {
                var row = clone(incoming || {});
                var existing = null;
                if (conflict) {
                    existing = rows.find(function (r) { return String(r[conflict]) === String(row[conflict]); });
                } else if (row.id !== undefined && row.id !== null) {
                    existing = rows.find(function (r) { return String(r.id) === String(row.id); });
                }
                if (existing) {
                    Object.keys(row).forEach(function (k) { existing[k] = clone(row[k]); });
                    existing.updated_at = nowISO();
                    return existing;
                }
                row.id = autoId(table, row);
                if (!row.created_at && table !== 'settings') row.created_at = nowISO();
                rows.push(row);
                return row;
            });
            saveDB(d);
            return { data: out.map(function (r) { return pickCols(r, this.returnCols); }.bind(this)), error: null };
        }

        if (this.op === 'delete') {
            var doomed = this.applyFilters(rows);
            d[table] = rows.filter(function (r) { return doomed.indexOf(r) === -1; });
            saveDB(d);
            return { data: doomed.map(function (r) { return pickCols(r, this.returnCols); }.bind(this)), error: null };
        }

        return { data: null, error: { message: 'Unknown operation', code: 'LOCAL_ERROR' } };
    };

    /* ─── AUTH ──────────────────────────────────────────────── */
    function emailOk(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '')); }

    var auth = {
        getUser: function () {
            var u = currentUser();
            return Promise.resolve({ data: { user: publicUser(u) }, error: null });
        },
        getSession: function () {
            var u = currentUser();
            return Promise.resolve({ data: { session: u ? { user: publicUser(u) } : null }, error: null });
        },
        signInWithPassword: function (creds) {
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var email = String((creds && creds.email) || '').trim().toLowerCase();
                    var pw = String((creds && creds.password) || '');
                    var u = db().users.find(function (x) { return x.email.toLowerCase() === email; });
                    if (!u || u.pw !== hashPw(pw, u.email.toLowerCase())) {
                        resolve({ data: { user: null, session: null }, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } });
                        return;
                    }
                    setSessionUserId(u.id);
                    var pub = publicUser(u);
                    resolve({ data: { user: pub, session: { user: pub } }, error: null });
                }, 150);
            });
        },
        signUp: function (creds) {
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var email = String((creds && creds.email) || '').trim().toLowerCase();
                    var pw = String((creds && creds.password) || '');
                    var name = (creds && creds.options && creds.options.data && creds.options.data.full_name) || '';
                    if (!emailOk(email)) { resolve({ data: { user: null, session: null }, error: { message: 'Invalid email', code: 'invalid_email' } }); return; }
                    if (pw.length < 6) { resolve({ data: { user: null, session: null }, error: { message: 'Password should be at least 6 characters', code: 'weak_password' } }); return; }
                    var d = db();
                    if (d.users.some(function (x) { return x.email.toLowerCase() === email; })) {
                        resolve({ data: { user: null, session: null }, error: { message: 'User already registered', code: 'user_already_exists' } });
                        return;
                    }
                    var u = { id: uid('u'), email: email, pw: hashPw(pw, email), name: String(name || '').trim(), role: 'customer', created_at: nowISO() };
                    d.users.push(u);
                    saveDB(d);
                    setSessionUserId(u.id);
                    var pub = publicUser(u);
                    resolve({ data: { user: pub, session: { user: pub } }, error: null });
                }, 150);
            });
        },
        // Demo mode has no OAuth redirect: one click signs in a demo
        // Google shopper instantly so every flow keeps working offline.
        signInWithOAuth: function () {
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var d = db();
                    var u = d.users.find(function (x) { return x.email === 'demo.google@gmail.com'; });
                    if (!u) {
                        u = { id: uid('u'), email: 'demo.google@gmail.com', pw: hashPw(uid('x'), 'demo.google@gmail.com'), name: 'Demo Google User', role: 'customer', created_at: nowISO() };
                        d.users.push(u);
                        saveDB(d);
                    }
                    setSessionUserId(u.id);
                    var pub = publicUser(u);
                    resolve({ data: { user: pub, session: { user: pub } }, error: null });
                }, 150);
            });
        },
        signOut: function () {
            setSessionUserId(null);
            return Promise.resolve({ error: null });
        },
        updateUser: function (attrs) {
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var u = currentUser();
                    if (!u) { resolve({ data: { user: null }, error: { message: 'Not authenticated', code: 'auth_error' } }); return; }
                    var d = db();
                    var rec = d.users.find(function (x) { return x.id === u.id; });
                    if (attrs && attrs.password) {
                        if (String(attrs.password).length < 6) { resolve({ data: { user: null }, error: { message: 'Password should be at least 6 characters', code: 'weak_password' } }); return; }
                        rec.pw = hashPw(String(attrs.password), rec.email.toLowerCase());
                    }
                    if (attrs && attrs.email) {
                        var em = String(attrs.email).trim().toLowerCase();
                        if (!emailOk(em)) { resolve({ data: { user: null }, error: { message: 'Invalid email', code: 'invalid_email' } }); return; }
                        if (d.users.some(function (x) { return x.id !== rec.id && x.email.toLowerCase() === em; })) {
                            resolve({ data: { user: null }, error: { message: 'Email already in use', code: 'email_in_use' } }); return;
                        }
                        // Keep admin access working if an admin changes email.
                        var oldEm = rec.email.toLowerCase();
                        d.admin_users.forEach(function (a) { if (String(a.email).toLowerCase() === oldEm) a.email = em; });
                        d.admin_roles.forEach(function (r) { if (String(r.email).toLowerCase() === oldEm) r.email = em; });
                        rec.email = em;
                    }
                    if (attrs && attrs.data && attrs.data.full_name !== undefined) rec.name = String(attrs.data.full_name);
                    saveDB(d);
                    resolve({ data: { user: publicUser(rec) }, error: null });
                }, 100);
            });
        },
        // Demo mode: no emails are sent — the account password is reset
        // to a known demo value so the shopper can sign straight back in.
        resetPasswordForEmail: function (email) {
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var em = String(email || '').trim().toLowerCase();
                    var d = db();
                    var rec = d.users.find(function (x) { return x.email.toLowerCase() === em; });
                    if (rec) { rec.pw = hashPw('demo1234', rec.email.toLowerCase()); saveDB(d); }
                    resolve({ data: {}, error: null });
                }, 150);
            });
        }
    };

    /* ─── RPCs (mirror all.sql / premium-v1.sql behavior) ───── */
    function settingVal(key, fallback) {
        var r = db().settings.find(function (s) { return s.key === key; });
        var v = r ? r.value : fallback;
        return (v === null || v === undefined || v === '') ? fallback : v;
    }

    function rpcValidateCoupon(p_code, p_subtotal, p_email) {
        var d = db();
        var code = String(p_code || '').trim().toUpperCase();
        var r = d.coupons.find(function (c) { return String(c.code).toUpperCase() === code; });
        if (!r) return { ok: false, error: 'INVALID' };
        if (!r.active) return { ok: false, error: 'INACTIVE' };
        var t = Date.now();
        if (r.valid_from && t < new Date(r.valid_from).getTime()) return { ok: false, error: 'NOT_STARTED' };
        if (r.valid_to && t > new Date(r.valid_to).getTime()) return { ok: false, error: 'EXPIRED' };
        if (r.usage_limit !== null && r.usage_limit !== undefined && (r.used_count || 0) >= r.usage_limit) return { ok: false, error: 'LIMIT_REACHED' };
        if (Number(p_subtotal) < (Number(r.min_order_amount) || 0)) return { ok: false, error: 'MIN_ORDER', min: Number(r.min_order_amount) || 0 };
        if (r.per_user_limit !== null && r.per_user_limit !== undefined && p_email) {
            var n = d.coupon_redemptions.filter(function (x) {
                return String(x.coupon_code).toUpperCase() === String(r.code).toUpperCase() &&
                    String(x.user_email || '').toLowerCase() === String(p_email).toLowerCase();
            }).length;
            if (n >= r.per_user_limit) return { ok: false, error: 'PER_USER_LIMIT' };
        }
        var disc = (r.discount_type === 'percentage') ? Number(p_subtotal) * (Number(r.discount_value) || 0) / 100 : (Number(r.discount_value) || 0);
        if (r.max_discount !== null && r.max_discount !== undefined) disc = Math.min(disc, Number(r.max_discount));
        disc = Math.min(Math.max(disc, 0), Number(p_subtotal));
        return { ok: true, code: r.code, discount: Math.floor(disc), type: r.discount_type, campaign: r.campaign || '' };
    }

    function orderTotals(items, couponCode) {
        var d = db();
        var subtotal = 0, qty = 0, lines = [];
        for (var i = 0; i < items.length; i++) {
            var pid = items[i] && items[i].product_id;
            var q = Math.min(Math.max(parseInt(items[i] && items[i].quantity, 10) || 0, 0), 10);
            var p = d.products.find(function (x) { return String(x.id) === String(pid); });
            if (!p || !q) return { error: 'INVALID_PRODUCT' };
            if (p.in_stock === false) return { error: 'OUT_OF_STOCK' };
            if (p.stock_quantity !== null && p.stock_quantity !== undefined && p.stock_quantity < q) return { error: 'OUT_OF_STOCK' };
            var price = Number(p.price) || 0;
            subtotal += price * q;
            qty += q;
            lines.push({ product_id: p.id, quantity: q, price: price, name: p.title, image: p.image || '' });
        }
        if (!lines.length || qty > 100) return { error: 'INVALID_INPUT' };
        var discount = 0, coupon = null;
        if (couponCode) {
            var v = rpcValidateCoupon(couponCode, subtotal, null);
            if (!v.ok) return { error: 'INVALID_COUPON' };
            discount = v.discount;
            coupon = v.code;
        }
        var freeAbove = parseFloat(settingVal('shipping_free_above', '2000')) || 2000;
        var shipCost = parseFloat(settingVal('shipping_cost', '100')) || 0;
        var shipping = subtotal >= freeAbove ? 0 : shipCost;
        return { subtotal: subtotal, discount: discount, shipping: shipping, total: Math.max(0, subtotal + shipping - discount), lines: lines, coupon: coupon };
    }

    function rpcCreateOrderSecure(a) {
        var d = db();
        var me = currentUser();
        var modeRow = d.settings.find(function (s) { return s.key === 'customer_order_mode'; });
        var mode = (modeRow && (modeRow.value === 'guest' || modeRow.value === 'login')) ? modeRow.value : 'login';
        if (!me && mode === 'login') return { ok: false, error: 'LOGIN_REQUIRED' };

        var cap = function (v, n) { return String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, n); };
        var name = cap(a.p_name, 80), email = cap(a.p_email, 320).toLowerCase(), phone = cap(a.p_phone, 30);
        var a1 = cap(a.p_address1, 200), a2 = cap(a.p_address2, 200), city = cap(a.p_city, 80);
        var state = cap(a.p_state, 80), area = cap(a.p_area, 80), country = cap(a.p_country, 80);
        var pay = cap(a.p_payment_method, 80), coupon = cap(a.p_coupon_code, 40).toUpperCase();
        var idem = cap(a.p_idempotency_key, 100);

        if (name.length < 2) return { ok: false, error: 'INVALID_INPUT' };
        if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) return { ok: false, error: 'INVALID_INPUT' };
        var digits = phone.replace(/[^0-9]/g, '');
        if (digits.length < 6 || digits.length > 15) return { ok: false, error: 'INVALID_INPUT' };
        if (a1.length < 5 || city.length < 2 || country.length < 2) return { ok: false, error: 'INVALID_INPUT' };
        if (!pay) return { ok: false, error: 'INVALID_PAYMENT' };
        if (!Array.isArray(a.p_items) || !a.p_items.length || a.p_items.length > 50) return { ok: false, error: 'INVALID_INPUT' };

        if (idem && !/^[A-Za-z0-9_.:~+-]{8,100}$/.test(idem)) idem = '';
        if (idem) {
            var dup = d.orders.find(function (o) { return o.idempotency_key === idem; });
            if (dup) return { ok: true, deduped: true, order_id: dup.id, order_number: dup.order_number };
        } else { idem = null; }

        var hourAgo = Date.now() - 3600000;
        var recent = d.orders.filter(function (o) {
            return new Date(o.created_at).getTime() > hourAgo &&
                (String(o.customer_email).toLowerCase() === email || String(o.customer_phone) === phone);
        }).length;
        if (recent >= 5) return { ok: false, error: 'RATE_LIMITED' };

        var pm = d.payment_settings.find(function (m) { return m.method_name === pay && m.enabled !== false && (m.status || 'available') === 'available'; });
        if (!pm) return { ok: false, error: 'INVALID_PAYMENT' };

        var t = orderTotals(a.p_items, coupon || null);
        if (t.error) return { ok: false, error: t.error };
        var total = Math.max(0, Math.round((t.subtotal + t.shipping + (Number(pm.fee) || 0) - t.discount) * 100) / 100);

        var num = 'ORD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
        var id = nextId('orders');
        var order = {
            id: id, order_number: num, user_id: me ? me.id : null, is_guest: !me,
            customer_name: name, customer_email: email, customer_phone: phone,
            address_line1: a1, address_line2: a2 || null, city: city, state: state || null,
            area: area || null, country: country,
            total_amount: total, discount: t.discount, shipping_cost: t.shipping,
            coupon_code: t.coupon, payment_method: pay, payment_status: 'pending', status: 'pending',
            estimated_delivery: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            idempotency_key: idem, created_at: nowISO()
        };
        d.orders.push(order);
        t.lines.forEach(function (l) {
            d.order_items.push({ id: nextId('order_items'), order_id: id, product_id: l.product_id, product_name: l.name, product_price: l.price, quantity: l.quantity, image_url: l.image || null });
            var p = d.products.find(function (x) { return x.id === l.product_id; });
            if (p && p.stock_quantity !== null && p.stock_quantity !== undefined) {
                p.stock_quantity = Math.max(0, p.stock_quantity - l.quantity);
                if (p.stock_quantity <= 0) p.in_stock = false;
            }
        });
        if (t.coupon) {
            var c = d.coupons.find(function (x) { return x.code === t.coupon; });
            if (c) c.used_count = (c.used_count || 0) + 1;
            d.coupon_redemptions.push({ id: nextId('coupon_redemptions'), coupon_code: t.coupon, order_id: id, user_email: email, created_at: nowISO() });
        }
        saveDB(d);
        try { localStorage.setItem('eshop_products', JSON.stringify(d.products.map(toCatalogShape))); } catch (_) {}
        return { ok: true, order_id: id, order_number: num };
    }

    // Catalog shape mirrors js/core/products-loader.js normalizeProductRow
    // output so every page keeps working off the synced cache.
    function toCatalogShape(p) {
        return {
            id: p.id, title: p.title, category: p.category, brand: (p.details && p.details.brand) || '',
            price: Number(p.price) || 0,
            originalPrice: (p.original_price === null || p.original_price === undefined) ? null : Number(p.original_price),
            rating: Number(p.rating) || 0, reviews: parseInt(p.reviews, 10) || 0,
            sold: (p.details && p.details.sold) || '', description: p.description || '',
            image: p.image || '', images: p.images || [],
            badge: p.badge || '', stockQty: (p.stock_quantity === null || p.stock_quantity === undefined) ? null : p.stock_quantity,
            inStock: p.in_stock !== false && (p.stock_quantity === null || p.stock_quantity === undefined || p.stock_quantity > 0),
            specs: p.specs || {}, shortDesc: (p.details && p.details.shortDesc) || '',
            fullDesc: (p.details && p.details.fullDesc) || '', sections: (p.details && p.details.sections) || [],
            related: (p.details && p.details.related) || []
        };
    }

    function rpcGetOrderPublic(number) {
        var d = db();
        var o = d.orders.find(function (x) { return x.order_number === String(number || '').trim(); });
        if (!o) return { ok: false, error: 'NOT_FOUND' };
        var items = d.order_items.filter(function (i) { return String(i.order_id) === String(o.id); })
            .sort(function (a, b) { return String(a.product_name) < String(b.product_name) ? -1 : 1; })
            .map(function (i) { return { product_name: i.product_name, product_price: i.product_price, quantity: i.quantity, image_url: i.image_url }; });
        return {
            ok: true,
            order: {
                id: o.id, order_number: o.order_number, status: o.status, payment_method: o.payment_method,
                payment_status: o.payment_status, total_amount: o.total_amount, discount: o.discount,
                shipping_cost: o.shipping_cost, created_at: o.created_at, estimated_delivery: o.estimated_delivery
            },
            items: items
        };
    }

    function rpcSubmitReview(a) {
        var me = currentUser();
        if (!me) return { ok: false, error: 'NOT_AUTHENTICATED' };
        var pid = a.p_product_id, rating = parseInt(a.p_rating, 10);
        if (pid === null || pid === undefined || !(rating >= 1 && rating <= 5)) return { ok: false, error: 'INVALID_INPUT' };
        var d = db();
        var bought = d.orders.some(function (o) {
            return String(o.user_id) === String(me.id) && o.status === 'delivered' &&
                d.order_items.some(function (i) { return String(i.order_id) === String(o.id) && String(i.product_id) === String(pid); });
        });
        if (!bought) return { ok: false, error: 'PRODUCT_NOT_PURCHASED' };
        if (d.reviews.some(function (r) { return String(r.product_id) === String(pid) && String(r.user_id) === String(me.id); })) {
            return { ok: false, error: 'ALREADY_REVIEWED' };
        }
        var name = String(a.p_reviewer_name || '').trim() || 'Verified Buyer';
        var r = {
            id: 'rev-' + nextId('reviews'), product_id: (typeof pid === 'number') ? pid : parseInt(pid, 10) || pid,
            user_id: me.id, reviewer_name: name, rating: rating,
            review_text: String(a.p_review_text || '').trim(),
            images: Array.isArray(a.p_images) ? a.p_images : [], video_url: a.p_video_url || null,
            source: 'customer', is_published: true, created_at: nowISO(), updated_at: nowISO()
        };
        d.reviews.push(r);
        saveDB(d);
        return { ok: true, id: r.id };
    }

    function isAdminEmail(email) {
        var d = db();
        var e = String(email || '').toLowerCase();
        if (d.admin_roles.some(function (r) { return String(r.email).toLowerCase() === e && r.role === 'super_admin'; })) return true;
        return d.admin_users.some(function (u) { return String(u.email).toLowerCase() === e; });
    }

    function rpcSetOrderStatus(orderId, status) {
        var me = currentUser();
        var actor = me ? me.email : null;
        if (!actor || !isAdminEmail(actor)) return { ok: false, error: 'FORBIDDEN' };
        var ok = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded', 'payment_failed'];
        if (ok.indexOf(status) === -1) return { ok: false, error: 'BAD_STATUS' };
        var d = db();
        var o = d.orders.find(function (x) { return String(x.id) === String(orderId); });
        if (!o) return { ok: false, error: 'NOT_FOUND' };
        var from = o.status;
        o.status = status;
        if (status === 'cancelled' && ['cancelled', 'refunded', 'returned'].indexOf(from) === -1) {
            d.order_items.filter(function (i) { return String(i.order_id) === String(o.id); }).forEach(function (i) {
                var p = d.products.find(function (x) { return String(x.id) === String(i.product_id); });
                if (p) {
                    p.stock_quantity = (p.stock_quantity || 0) + i.quantity;
                    p.in_stock = true;
                    d.inventory_ledger.push({ id: nextId('inventory_ledger'), product_id: p.id, variant_id: null, change_qty: i.quantity, reason: 'order_cancel', order_id: o.id, actor_email: actor, note: null, created_at: nowISO() });
                }
            });
        }
        d.audit_logs.push({ id: nextId('audit_logs'), actor_email: actor, action: 'order.status', entity: 'order', entity_id: String(o.id), metadata: { from: from, to: status }, created_at: nowISO() });
        saveDB(d);
        return { ok: true, from: from, to: status };
    }

    function rpcAdjustStock(pid, vid, delta, reason, note) {
        var me = currentUser();
        var actor = me ? me.email : null;
        if (!actor || !isAdminEmail(actor)) return { ok: false, error: 'FORBIDDEN' };
        if (!delta) return { ok: false, error: 'EMPTY_DELTA' };
        var d = db();
        var p = d.products.find(function (x) { return String(x.id) === String(pid); });
        if (!p) return { ok: false, error: 'NOT_FOUND' };
        var cur = (p.stock_quantity === null || p.stock_quantity === undefined) ? 0 : p.stock_quantity;
        if (cur + delta < 0) return { ok: false, error: 'NEGATIVE_STOCK' };
        p.stock_quantity = cur + delta;
        p.in_stock = p.stock_quantity > 0;
        d.inventory_ledger.push({ id: nextId('inventory_ledger'), product_id: p.id, variant_id: null, change_qty: delta, reason: reason || 'adjustment', order_id: null, actor_email: actor, note: note || null, created_at: nowISO() });
        d.audit_logs.push({ id: nextId('audit_logs'), actor_email: actor, action: 'inventory.adjust', entity: 'product', entity_id: String(p.id), metadata: { delta: delta, reason: reason || 'adjustment' }, created_at: nowISO() });
        saveDB(d);
        return { ok: true };
    }

    function rpcAdminStats() {
        var me = currentUser();
        if (!me || !isAdminEmail(me.email)) return { ok: false, error: 'FORBIDDEN' };
        var d = db();
        var live = d.orders.filter(function (o) { return ['cancelled', 'returned', 'refunded'].indexOf(o.status) === -1; });
        var sum = function (list) { return list.reduce(function (s, o) { return s + (Number(o.total_amount) || 0); }, 0); };
        var week = Date.now() - 7 * 86400000, month = Date.now() - 30 * 86400000;
        var after = function (t) { return live.filter(function (o) { return new Date(o.created_at).getTime() >= t; }); };
        var users = {};
        d.orders.forEach(function (o) { if (o.user_id) users[o.user_id] = 1; });
        var n = new Date();
        var todayOrders = live.filter(function (o) {
            var dt = new Date(o.created_at);
            return dt.getFullYear() === n.getFullYear() && dt.getMonth() === n.getMonth() && dt.getDate() === n.getDate();
        });
        return {
            ok: true,
            revenue_total: sum(live), revenue_today: sum(todayOrders),
            revenue_week: sum(after(week)), revenue_month: sum(after(month)),
            orders_total: d.orders.length,
            orders_pending: d.orders.filter(function (o) { return o.status === 'pending'; }).length,
            orders_processing: d.orders.filter(function (o) { return ['confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery'].indexOf(o.status) > -1; }).length,
            orders_delivered: d.orders.filter(function (o) { return o.status === 'delivered'; }).length,
            orders_cancelled: d.orders.filter(function (o) { return ['cancelled', 'returned', 'refunded'].indexOf(o.status) > -1; }).length,
            products_total: d.products.length,
            products_low: d.products.filter(function (p) { var q = p.stock_quantity || 0; return q >= 1 && q <= (p.low_stock_threshold === undefined ? 5 : p.low_stock_threshold); }).length,
            products_out: d.products.filter(function (p) { return (p.stock_quantity || 0) <= 0 || p.in_stock === false; }).length,
            customers_total: Object.keys(users).length
        };
    }

    function rpc(name, args) {
        var d = db();
        var done = function (data) { return Promise.resolve({ data: data, error: null }); };
        var fail = function (message, code) { return Promise.resolve({ data: null, error: { message: message, code: code || 'LOCAL_ERROR' } }); };
        try {
            switch (name) {
                case 'validate_coupon':
                    return done(rpcValidateCoupon(args.p_code, args.p_subtotal, args.p_email));
                case 'create_order_secure':
                    return done(rpcCreateOrderSecure(args || {}));
                case 'decrement_stock': {
                    var p = d.products.find(function (x) { return String(x.id) === String(args.product_id); });
                    if (p && p.stock_quantity !== null && p.stock_quantity !== undefined) {
                        p.stock_quantity = Math.max(0, p.stock_quantity - (parseInt(args.quantity, 10) || 0));
                        if (p.stock_quantity <= 0) p.in_stock = false;
                    }
                    saveDB(d);
                    return done(p ? p.stock_quantity : 0);
                }
                case 'increment_coupon_used': {
                    var c = d.coupons.find(function (x) { return String(x.code).toUpperCase() === String(args.code || '').toUpperCase(); });
                    if (c) { c.used_count = (c.used_count || 0) + 1; saveDB(d); }
                    return done(null);
                }
                case 'get_order_public':
                    return done(rpcGetOrderPublic(args.p_order_number));
                case 'submit_customer_review':
                    return done(rpcSubmitReview(args || {}));
                case 'customer_can_review': {
                    var me = currentUser();
                    var can = !!(me && d.orders.some(function (o) {
                        return String(o.user_id) === String(me.id) && o.status === 'delivered' &&
                            d.order_items.some(function (i) { return String(i.order_id) === String(o.id) && String(i.product_id) === String(args.p_product); });
                    }));
                    return done(can);
                }
                case 'set_order_status':
                    return done(rpcSetOrderStatus(args.p_order_id, args.p_status));
                case 'adjust_stock':
                    return done(rpcAdjustStock(args.p_product_id, args.p_variant_id, args.p_delta, args.p_reason, args.p_note));
                case 'admin_stats':
                    return done(rpcAdminStats());
                default:
                    return fail('Function ' + name + ' is not available in demo mode', 'PGRST202');
            }
        } catch (e) {
            return fail((e && e.message) || 'Local RPC failed');
        }
    }

    function createClient() {
        return {
            __local: true,
            from: function (table) {
                return {
                    // from('t').select(cols) → filterable builder
                    select: function (cols) { return new Builder(table, 'select', cols || '*'); },
                    insert: function (payload) { return new Builder(table, 'insert', payload); },
                    update: function (patch) { return new Builder(table, 'update', patch); },
                    upsert: function (payload, opts) { return new Builder(table, 'upsert', payload, opts); },
                    delete: function () { return new Builder(table, 'delete', null); }
                };
            },
            rpc: rpc,
            auth: auth
        };
    }

    /* ─── PUBLIC API ────────────────────────────────────────── */
    window.LocalBackend = {
        version: 1,
        useLocal: useLocal,
        createClient: createClient,
        currentUser: function () { return publicUser(currentUser()); },
        isAdmin: function (email) { return isAdminEmail(email); },
        reset: function () {
            DB = seedDB();
            saveDB(DB);
            return true;
        },
        exportDB: function () { return clone(db()); },
        DEMO: {
            adminEmail: 'admin@eshop.demo',
            adminPassword: 'Demo123!',
            customerEmail: 'demo@eshop.demo',
            customerPassword: 'demo123'
        }
    };
})();
