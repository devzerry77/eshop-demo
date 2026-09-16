-- ────────────────────────────────────────────────────────────────
-- products.sql  —  Real Daraz-style product seed data (BDT)
--
-- Run this AFTER all.sql has created the `products` table.
-- In Supabase: SQL Editor -> open products.sql -> Run.
--
-- Data sources: real Daraz Bangladesh / Bangladeshi retailer
-- listings (avg. market prices, Sept 2026). Prices are in BDT.
-- Images are seeded placeholders, matching the existing site
-- defaults; swap `url` values with real Daraz image links if needed.
-- ────────────────────────────────────────────────────────────────

-- Optional: clear existing seed products first
-- DELETE FROM products;

-- ── ELECTRONICS (Smartphones) ────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Samsung Galaxy A36 5G (128GB)',
  'electronics',
  29999, 32999, 4.7, 214,
  '6.6-inch 120Hz Super AMOLED+ display, Snapdragon 6 Gen 3, 50MP OIS camera and 5000mAh battery with official 1-year warranty.',
  'https://picsum.photos/seed/galaxy-a36/400/400',
  '[{"url":"https://picsum.photos/seed/galaxy-a36/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/galaxy-a36-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Display":"6.6\" 120Hz Super AMOLED+","Processor":"Snapdragon 6 Gen 3","Camera":"50MP OIS","Battery":"5000mAh","RAM":"6GB","Storage":"128GB","Warranty":"1 Year"}',
  '{"brand":"Samsung","sold":"1.1K+ sold","shortDesc":"Best-selling 5G phone with 120Hz AMOLED display.","fullDesc":"The Galaxy A36 5G delivers a flagship-like experience at a mid-range price with a 6.6-inch 120Hz Super AMOLED+ panel, Snapdragon 6 Gen 3 processor, 50MP OIS main camera and a 5000mAh battery. Official Samsung BD warranty included.","sections":[{"title":"Highlights","body":"120Hz Super AMOLED+ display | 50MP OIS camera | 4 years OS updates"},{"title":"In the box","body":"Phone, Type-C cable, adapter, SIM ejector tool"}],"related":[]}'
),
(
  'realme 15 5G',
  'electronics',
  27990, 30490, 4.5, 96,
  '12GB RAM, 256GB storage, 108MP camera, 120Hz AMOLED display and 67W fast charging.',
  'https://picsum.photos/seed/realme-15/400/400',
  '[{"url":"https://picsum.photos/seed/realme-15/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/realme-15-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Display":"6.7\" 120Hz AMOLED","Camera":"108MP","Battery":"5500mAh","Charging":"67W","RAM":"12GB","Storage":"256GB","Warranty":"1 Year"}',
  '{"brand":"realme","sold":"480+ sold","shortDesc":"Maximum specs under 30K.","fullDesc":"realme 15 5G packs 12GB RAM, 256GB storage, a 108MP main camera and 67W fast charging with a 120Hz AMOLED display. The best specs-to-price ratio in the 25K-30K segment.","sections":[{"title":"Highlights","body":"12GB RAM + 256GB storage | 108MP camera | 67W charging"},{"title":"In the box","body":"Phone, 67W adapter, USB cable, case"}],"related":[]}'
),
(
  'Redmi Note 15 5G',
  'electronics',
  24990, 27490, 4.6, 143,
  '108MP camera, 120Hz AMOLED display, Dimensity 6080 processor and 67W fast charging with Xiaomi official warranty.',
  'https://picsum.photos/seed/redmi-note-15/400/400',
  '[{"url":"https://picsum.photos/seed/redmi-note-15/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/redmi-note-15-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Display":"6.67\" 120Hz AMOLED","Camera":"108MP","Battery":"5000mAh","Charging":"67W","Processor":"Dimensity 6080","RAM":"8GB","Storage":"256GB","Warranty":"1 Year"}',
  '{"brand":"Xiaomi","sold":"890+ sold","shortDesc":"108MP camera phone under 25K.","fullDesc":"The Redmi Note 15 5G brings a 108MP camera and 120Hz AMOLED display into the under-25K segment, powered by the Dimensity 6080 with 67W fast charging.","sections":[{"title":"Highlights","body":"108MP camera | 120Hz AMOLED | 67W fast charging"},{"title":"In the box","body":"Phone, 67W adapter, USB cable, protective case"}],"related":[]}'
),
(
  'Samsung Galaxy A26 5G',
  'electronics',
  27999, 29999, 4.6, 88,
  '6.5-inch 120Hz Super AMOLED, 50MP OIS camera, Exynos 1380 and 5000mAh battery with 4-year software support.',
  'https://picsum.photos/seed/galaxy-a26/400/400',
  '[{"url":"https://picsum.photos/seed/galaxy-a26/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/galaxy-a26-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Display":"6.5\" 120Hz Super AMOLED","Camera":"50MP OIS","Battery":"5000mAh","Processor":"Exynos 1380","RAM":"6GB","Storage":"128GB","Warranty":"1 Year"}',
  '{"brand":"Samsung","sold":"330+ sold","shortDesc":"Long-term software support at a fair price.","fullDesc":"Galaxy A26 5G offers a 120Hz Super AMOLED display, 50MP OIS camera and 4-year OS / 5-year security updates. A dependable all-rounder from Samsung.","sections":[{"title":"Highlights","body":"120Hz Super AMOLED | 4-year OS updates | 50MP OIS"},{"title":"In the box","body":"Phone, Type-C cable, adapter"}],"related":[]}'
);

-- ── ACCESSORIES ─────────────────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Baseus 15W Cobble Qi Wireless Charger',
  'accessories',
  1150, 1850, 4.4, 156,
  '15W max output, non-slip silicone ring, foreign-object detection and LED indicator. Charges through most phone cases.',
  'https://picsum.photos/seed/baseus-charger/400/400',
  '[{"url":"https://picsum.photos/seed/baseus-charger/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/baseus-charger-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Output":"15W Max","Input":"Type-C 5V/2A, 9V/2A","Standard":"Qi","Compatibility":"iPhone, Samsung, Xiaomi","Accessory":"Type-C cable","Brand":"Baseus"}',
  '{"brand":"Baseus","sold":"2K+ sold","shortDesc":"Popular 15W wireless charging pad.","fullDesc":"The Baseus Cobble wireless charger delivers 15W fast charging with foreign-object detection and works through protective cases up to 4mm thick.","sections":[{"title":"Highlights","body":"15W Qi fast charge | LED indicator | Non-slip design"},{"title":"Compatible","body":"Qi-enabled iPhones and Android devices"}],"related":[]}'
),
(
  'Anker Nano 33W GaN Fast Charger (Type-C)',
  'accessories',
  1200, 1600, 4.5, 233,
  '33W GaN technology, single USB-C port, fast charging for iPhone and Android with full safety protection.',
  'https://picsum.photos/seed/anker-nano/400/400',
  '[{"url":"https://picsum.photos/seed/anker-nano/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/anker-nano-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Output":"33W Max","Ports":"USB-C (1)","Technology":"GaN II","Plug":"US / EU","Brand":"Anker","Warranty":"18 Months"}',
  '{"brand":"Anker","sold":"3.4K+ sold","shortDesc":"Mini 33W GaN charger for fast top-ups.","fullDesc":"Anker Nano 33W uses GaN II technology to pack powerful 33W fast charging into a compact size, ideal for travel and daily use.","sections":[{"title":"Highlights","body":"33W GaN II | Compact size | MultiProtect safety"},{"title":"In the box","body":"Charger only (cable not included)"}],"related":[]}'
),
(
  'Baseus 10000mAh Mini Power Bank',
  'accessories',
  1499, 1999, 4.5, 312,
  '20W PD fast charging, 10000mAh capacity, digital display and dual output in a slim lightweight design.',
  'https://picsum.photos/seed/baseus-powerbank/400/400',
  '[{"url":"https://picsum.photos/seed/baseus-powerbank/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/baseus-powerbank-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Capacity":"10000mAh","Output":"20W PD / 18W QC","Ports":"USB-C + USB-A","Display":"Digital LED %","Brand":"Baseus"}',
  '{"brand":"Baseus","sold":"1.8K+ sold","shortDesc":"Slim power bank with digital display.","fullDesc":"Baseus Mini power bank charges your phone twice with 20W PD fast output, showing remaining battery level on a clear digital display.","sections":[{"title":"Highlights","body":"20W PD output | Digital display | Dual ports"},{"title":"In the box","body":"Power bank, short USB-C cable"}],"related":[]}'
),
(
  '9H Tempered Glass Screen Protector (UV Full Cover)',
  'accessories',
  199, 299, 4.2, 678,
  '9H hardness tempered glass with oleophobic coating, full screen coverage and easy bubble-free installation kit.',
  'https://picsum.photos/seed/tempered-glass/400/400',
  '[{"url":"https://picsum.photos/seed/tempered-glass/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/tempered-glass-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Hardness":"9H","Coverage":"Full (3D curved)","Coating":"Oleophobic","Thickness":"0.33mm","Kit":"Wipes + dust absorber"}',
  '{"brand":"Generic","sold":"9K+ sold","shortDesc":"Bestselling UV tempered glass on Daraz.","fullDesc":"Shock-resistant 9H tempered glass with an oleophobic coating that resists fingerprints, plus a complete DIY installation kit.","sections":[{"title":"Highlights","body":"9H hardened | Anti-fingerprint | Kit included"},{"title":"Compatibility","body":"Select your phone model from options"}],"related":[]}'
);

-- ── AUDIO ───────────────────────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Awei PC-2 3.5mm Wired Earphone',
  'audio',
  390, 450, 4.1, 512,
  'Lightweight in-ear earphone with 3.5mm jack, inline mic and 3-button remote. Deep bass sound at an unbeatable price.',
  'https://picsum.photos/seed/awei-earphone/400/400',
  '[{"url":"https://picsum.photos/seed/awei-earphone/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/awei-earphone-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Jack":"3.5mm","Mic":"Yes (inline)","Driver":"10mm","Cable Length":"1.2m","Brand":"Awei"}',
  '{"brand":"Awei","sold":"7.5K+ sold","shortDesc":"Bangladesh bestselling budget wired earphone.","fullDesc":"The Awei PC-2 delivers punchy bass, a clear inline microphone and a tangle-resistant cable for office, study and calls.","sections":[{"title":"Highlights","body":"Deep bass | Inline mic | Universal 3.5mm jack"},{"title":"Note","body":"Classic 3.5mm headphones - not USB-C"}],"related":[]}'
),
(
  'Baseus Bowie MA10 TWS Wireless Earbuds',
  'audio',
  2199, 3199, 4.3, 421,
  'ENC noise-reduction mics, 13mm drivers, touch controls and up to 30 hours total battery life with charging case.',
  'https://picsum.photos/seed/bowie-earbuds/400/400',
  '[{"url":"https://picsum.photos/seed/bowie-earbuds/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/bowie-earbuds-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Bluetooth":"5.3","Driver":"13mm","Battery":"30H (with case)","Charging":"USB-C","Mic":"ENC noise-reduction","Brand":"Baseus"}',
  '{"brand":"Baseus","sold":"1.6K+ sold","shortDesc":"TWS earbuds with clear calls and big sound.","fullDesc":"Baseus Bowie MA10 earbuds bring 13mm dynamic drivers, ENC call noise-reduction and 30 hours of total playback in a lightweight ergonomic design.","sections":[{"title":"Highlights","body":"13mm drivers | 30H battery | ENC mic"},{"title":"In the box","body":"Earbuds, charging case, USB-C cable"}],"related":[]}'
),
(
  'JBL GO 4 Portable Bluetooth Speaker',
  'audio',
  2999, 3999, 4.6, 89,
  'JBL Pro Sound, IP67 waterproof design, up to 7 hours playtime and a compact pocketable size.',
  'https://picsum.photos/seed/jbl-go4/400/400',
  '[{"url":"https://picsum.photos/seed/jbl-go4/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/jbl-go4-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Output":"JBL Pro Sound","Bluetooth":"5.3","Battery":"7H","Waterproof":"IP67","Brand":"JBL","Warranty":"1 Year"}',
  '{"brand":"JBL","sold":"250+ sold","shortDesc":"Pocket wireless speaker, fully waterproof.","fullDesc":"The JBL GO 4 is a tiny portable speaker with JBL Pro Sound, IP67 waterproof build and 7 hours of playtime, perfect for trips and outdoor use.","sections":[{"title":"Highlights","body":"JBL Pro Sound | IP67 waterproof | 7H battery"},{"title":"In the box","body":"Speaker, USB-C cable, strap"}],"related":[]}'
);

-- ── WEARABLES ───────────────────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Xiaomi Redmi Watch 5 Active',
  'wearables',
  4999, 5999, 4.4, 178,
  '1.96-inch AMOLED display, 140+ sport modes, Bluetooth calling and 18-day battery life.',
  'https://picsum.photos/seed/redmi-watch5/400/400',
  '[{"url":"https://picsum.photos/seed/redmi-watch5/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/redmi-watch5-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Display":"1.96\" AMOLED","Battery":"18 Days","Bluetooth Calling":"Yes","Sport Modes":"140+","Water Resistant":"5ATM","Brand":"Xiaomi"}',
  '{"brand":"Xiaomi","sold":"1.3K+ sold","shortDesc":"Big AMOLED smart watch with calling.","fullDesc":"Redmi Watch 5 Active pairs a large 1.96-inch AMOLED screen with Bluetooth calling, 140+ sport modes and an 18-day battery for all-day wear.","sections":[{"title":"Highlights","body":"AMOLED display | Bluetooth calling | 18-day battery"},{"title":"In the box","body":"Watch, charging cable, manual"}],"related":[]}'
),
(
  'Xiaomi Smart Band 9',
  'wearables',
  2699, 3199, 4.5, 245,
  '1.62-inch AMOLED display, 150+ sport modes, SpO2 and heart-rate monitoring with 21-day battery.',
  'https://picsum.photos/seed/mi-band9/400/400',
  '[{"url":"https://picsum.photos/seed/mi-band9/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/mi-band9-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Display":"1.62\" AMOLED","Battery":"21 Days","Health":"SpO2 + HR + Sleep","Sport Modes":"150+","Water Resistant":"5ATM","Brand":"Xiaomi"}',
  '{"brand":"Xiaomi","sold":"2.2K+ sold","shortDesc":"Fitness band with 21-day battery life.","fullDesc":"Xiaomi Smart Band 9 tracks heart rate, SpO2 and sleep across 150+ sport modes, with a bright AMOLED display and up to 21 days of battery.","sections":[{"title":"Highlights","body":"AMOLED display | 21-day battery | 150+ sport modes"},{"title":"In the box","body":"Band, proprietary charger, manual"}],"related":[]}'
);

-- ── GAMING ──────────────────────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Fantech ACGP01 Gamepad Holder Mobile Gaming Grip',
  'gaming',
  1150, 1550, 4.3, 167,
  'Adjustable smartphone gaming grip with cool-swap faceplates for trigger-free precision control.',
  'https://picsum.photos/seed/fantech-grip/400/400',
  '[{"url":"https://picsum.photos/seed/fantech-grip/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/fantech-grip-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Compatibility":"Phones 4.5\" - 7\"","Material":"ABS + silicone","Feature":"Cool-swap faceplate","Brand":"Fantech"}',
  '{"brand":"Fantech","sold":"540+ sold","shortDesc":"Comfort grip for mobile esports.","fullDesc":"The Fantech ACGP01 attaches firmly to any 4.5-7 inch phone for a comfortable, console-like grip during long Call of Duty Mobile and Free Fire sessions.","sections":[{"title":"Highlights","body":"Adjustable fit | Swappable faceplates | Anti-slip grip"},{"title":"Note","body":"Grip only - does not add physical triggers"}],"related":[]}'
),
(
  'Fantech K613 Valkyrie RGB Gaming Keyboard',
  'gaming',
  2299, 2899, 4.4, 198,
  'Rainbow backlit mechanical-feel keyboard with 31-key anti-ghosting and durable switches.',
  'https://picsum.photos/seed/fantech-k613/400/400',
  '[{"url":"https://picsum.photos/seed/fantech-k613/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/fantech-k613-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Layout":"Full (104 keys)","Backlight":"RGB Rainbow","Anti-Ghosting":"31 Keys","Interface":"USB","Brand":"Fantech"}',
  '{"brand":"Fantech","sold":"1.1K+ sold","shortDesc":"RGB gaming keyboard on a budget.","fullDesc":"Fantech K613 delivers colourful RGB backlighting, responsive keys and 31-key anti-ghosting - a great entry point for PC and mobile gaming.","sections":[{"title":"Highlights","body":"RGB backlight | Anti-ghosting | USB plug-and-play"},{"title":"In the box","body":"Keyboard, manual"}],"related":[]}'
);

-- ── CAMERA ──────────────────────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Akaso EK7000 4K Action Camera',
  'camera',
  7999, 9999, 4.2, 121,
  '4K30 video, 12MP photos, 2-inch touch screen, EIS image stabilization and waterproof housing to 30m.',
  'https://picsum.photos/seed/akaso-camera/400/400',
  '[{"url":"https://picsum.photos/seed/akaso-camera/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/akaso-camera-2/400/400","type":"image","order":2},{"url":"https://picsum.photos/seed/akaso-camera-3/400/400","type":"image","order":3}]',
  'Sale', true,
  '{"Video":"4K30fps","Photo":"12MP","Display":"2\" Touch","Stabilization":"EIS","Waterproof":"30m (housing)","Battery":"1050mAh","Brand":"Akaso"}',
  '{"brand":"Akaso","sold":"390+ sold","shortDesc":"Budget 4K action cam with mounting kit.","fullDesc":"The Akaso EK7000 records crisp 4K video and 12MP photos, with electronic image stabilization and a waterproof case down to 30 metres. Great for vlogging and travel.","sections":[{"title":"Highlights","body":"4K30 video | 30m waterproof | Touch display"},{"title":"In the box","body":"Camera, waterproof case, mounting kit, 2 batteries"}],"related":[]}'
);

-- ── LIFESTYLE / HOME ────────────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Baseus Fiber 1.5L Water Bottle',
  'lifestyle',
  1350, 1750, 4.4, 205,
  'Large 1.5L capacity bottle with time scale markings, leak-proof straw and carry loop. BPA-free material.',
  'https://picsum.photos/seed/baseus-bottle/400/400',
  '[{"url":"https://picsum.photos/seed/baseus-bottle/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/baseus-bottle-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Capacity":"1.5L","Material":"BPA-free Tritan","Feature":"Time markings + carry loop","Brand":"Baseus"}',
  '{"brand":"Baseus","sold":"890+ sold","shortDesc":"Gym and office water bottle bestseller.","fullDesc":"Keep hydration on track with the Baseus Fiber 1.5L bottle - it shows hourly time markings, a leak-proof straw lid and a soft carry loop.","sections":[{"title":"Highlights","body":"1.5L capacity | Time markings | Leak-proof straw"},{"title":"Note","body":"Hand wash recommended"}],"related":[]}'
),
(
  'Walton Electric Kettle 1.8L',
  'lifestyle',
  1499, 1899, 4.3, 267,
  '1.8-litre stainless steel electric kettle, 1200W, automatic shut-off and boil-dry protection with 1-year warranty.',
  'https://picsum.photos/seed/walton-kettle/400/400',
  '[{"url":"https://picsum.photos/seed/walton-kettle/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/walton-kettle-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Capacity":"1.8L","Power":"1200W","Material":"Stainless Steel","Safety":"Auto shut-off + boil-dry","Brand":"Walton","Warranty":"1 Year"}',
  '{"brand":"Walton","sold":"1.9K+ sold","shortDesc":"Fast-boiling stainless steel kettle.","fullDesc":"The Walton 1.8L kettle boils water quickly with a 1200W element, stainless steel body, automatic shut-off and boil-dry protection for complete safety.","sections":[{"title":"Highlights","body":"1200W quick boil | Auto shut-off | 1-year national warranty"},{"title":"In the box","body":"Kettle, base, manual"}],"related":[]}'
);

-- Done. 18 products seeded. Use the Admin panel -> Products to edit images/details,
-- or run additional INSERT statements following the same format.