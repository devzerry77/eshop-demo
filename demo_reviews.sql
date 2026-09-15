-- ────────────────────────────────────────────────────────────────
-- demo_reviews.sql — DEMO / SAMPLE REVIEWS (test data only)
--
-- Run AFTER all.sql AND reviews.sql (the reviews table + trigger).
--
-- ⚠️ IMPORTANT
--   These are SAMPLE/DEMO reviews for testing the review UI only.
--   They are NOT genuine customer purchases.
--   Every reviewer name is suffixed with "[DEMO]" so they can never
--   be mistaken for real verified feedback.
--
-- Why source = 'admin'?
--   The reviews table stores verified customer reviews from real
--   users (source = 'customer', user_id = auth.uid()) and admin-made
--   custom reviews (source = 'admin', user_id = NULL). Because demo
--   rows have no real auth user behind them, they are inserted as
--   admin-source rows — exactly like reviews created in
--   Admin → Custom Reviews. They intentionally have NO user_id, so
--   they never claim a real purchase.
--
-- Re-run safety: this file can be run again; unique rows are
--   identified by a fixed (idempotent) reviewer name + product pair.
--   Use DELETE FROM public.reviews WHERE reviewer_name LIKE '%[DEMO]%';
--   to wipe them at any time.
--
-- product_id values: assume a clean run of all.sql + products.sql, so
--   products get sequential ids 1-18 in the order they were seeded
--   (Galaxy A36 = 1 ... Walton Kettle = 18). If your local product ids
--   differ, replace the id numbers with the ids from your products table.
-- YouTube video_url values are placeholder links (a working sample video)
--   to demonstrate the review-video embed feature — swap them for real
--   product-review video links if you want genuine-looking clips.
-- ────────────────────────────────────────────────────────────────

-- Optionally clear previous demo rows first (uncomment to re-seed clean):
-- DELETE FROM public.reviews WHERE reviewer_name LIKE '%[DEMO]%';

INSERT INTO public.reviews (product_id, user_id, reviewer_name, rating, review_text, images, video_url, source, is_published, created_at) VALUES
-- ── Product 1: Samsung Galaxy A36 5G (128GB) ──────────────────
(1, NULL, 'Rafi Ahmed [DEMO]', 5, 'Battery life is genuinely impressive — easy 1.5 days on normal use. The 120Hz AMOLED is silky smooth and the camera handles low light surprisingly well for this price tier. Very happy with the purchase.', '["https://picsum.photos/seed/demo1a/400/400", "https://picsum.photos/seed/demo1b/400/400"]'::jsonb, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'admin', true, '2026-07-12T09:15:00+00:00'),
(1, NULL, 'Nusrat Jahan [DEMO]', 4, 'Phone feels premium and the software updates are a big plus. Only wish the charger was in the box. Other than that, superb everyday performance.', '[]'::jsonb, NULL, 'admin', true, '2026-07-28T14:40:00+00:00'),
(1, NULL, 'Tanvir Iqbal [DEMO]', 5, 'Upgraded from an A2x series and the difference is night and day. Fast, bright display, great battery. Highly recommended.', '["https://picsum.photos/seed/demo1c/400/400"]'::jsonb, NULL, 'admin', true, '2026-08-02T11:05:00+00:00'),

-- ── Product 2: realme 15 5G ────────────────────────────────────
(2, NULL, 'Mahmudul Hasan [DEMO]', 5, 'Charging speed is crazy fast and the 5G support is a bonus for the price. Camera gives natural colours in daylight. Value for money!', '["https://picsum.photos/seed/demo2a/400/400"]'::jsonb, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'admin', true, '2026-07-19T18:22:00+00:00'),
(2, NULL, 'Sharmin Akter [DEMO]', 4, 'Good performance for everyday use and gaming is smooth at medium settings. Build feels a bit plastic-heavy but that is expected at this price.', '[]'::jsonb, NULL, 'admin', true, '2026-08-10T08:50:00+00:00'),

-- ── Product 3: Redmi Note 15 5G ────────────────────────────────
(3, NULL, 'Sajid Khan [DEMO]', 5, 'The best display in this segment. Bright, punchy and great for Netflix. Battery easily lasts the whole day with heavy use.', '["https://picsum.photos/seed/demo3a/400/400", "https://picsum.photos/seed/demo3b/400/400"]'::jsonb, NULL, 'admin', true, '2026-06-30T16:10:00+00:00'),
(3, NULL, 'Farhana Rahman [DEMO]', 4, 'Everything works well out of the box. MIUI is a bit heavy with ads in some apps but disabling them is easy. Overall a solid buy.', '[]'::jsonb, NULL, 'admin', true, '2026-07-22T13:30:00+00:00'),

-- ── Product 4: Samsung Galaxy A26 5G ───────────────────────────
(4, NULL, 'Imran Hossain [DEMO]', 4, 'Reliable daily driver. Samsung UI is clean, updates come on time. Camera is decent in good lighting. Would have loved a higher refresh rate.', '["https://picsum.photos/seed/demo4a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-05T10:45:00+00:00'),
(4, NULL, 'Joya Chowdhury [DEMO]', 5, 'Bought it for my parents — they love how simple and lag-free it is. Excellent build quality and warranty support.', '[]'::jsonb, NULL, 'admin', true, '2026-08-14T19:00:00+00:00'),

-- ── Product 5: Baseus 15W Cobble Qi Wireless Charger ───────────
(5, NULL, 'Alamgir Kabir [DEMO]', 5, 'Charges my phone and earbuds reliably. Small footprint, stays cool, and the build is solid. Great value.', '["https://picsum.photos/seed/demo5a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-14T20:30:00+00:00'),
(5, NULL, 'Tasnim Alam [DEMO]', 4, 'Works as advertised. Charging is not the fastest but perfect for overnight top-ups. Looks clean on the desk.', '[]'::jsonb, NULL, 'admin', true, '2026-08-05T09:20:00+00:00'),

-- ── Product 6: Anker Nano 33W GaN Fast Charger ────────────────
(6, NULL, 'Rahat Sheikh [DEMO]', 5, 'Tiny but powerful! Charges my phone from 0 to 60% in about 30 minutes. Plugs are tight and secure. This is my go-to travel charger.', '["https://picsum.photos/seed/demo6a/400/400", "https://picsum.photos/seed/demo6b/400/400"]'::jsonb, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'admin', true, '2026-08-01T15:55:00+00:00'),
(6, NULL, 'Mehzabin Sultana [DEMO]', 5, 'Replaced three big chargers with this one. Safe, cool and compact. Highly recommended.', '[]'::jsonb, NULL, 'admin', true, '2026-08-20T12:10:00+00:00'),

-- ── Product 7: Baseus 10000mAh Mini Power Bank ────────────────
(7, NULL, 'Arifuzzaman Rony [DEMO]', 4, 'Pocket-friendly and charges a phone almost twice. Output is decent and the indicator LEDs are helpful.', '["https://picsum.photos/seed/demo7a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-08T11:40:00+00:00'),
(7, NULL, 'Sabiha Nahar [DEMO]', 5, 'Perfect for long days out. Compact, lightweight and delivers the rated capacity. Delivery was fast too.', '[]'::jsonb, NULL, 'admin', true, '2026-08-11T17:25:00+00:00'),

-- ── Product 8: 9H Tempered Glass Screen Protector ──────────────
(8, NULL, 'Nayeem Ahmed [DEMO]', 4, 'Installation is easy with the alignment frame and the fingerprint sensor still works perfectly. Dipped once already, no scratches.', '["https://picsum.photos/seed/demo8a/400/400"]'::jsonb, NULL, 'admin', true, '2026-06-25T14:00:00+00:00'),
(8, NULL, 'Puja Saha [DEMO]', 3, 'Good protection but the UV glue bottle was messy for me on my first try. Curved edges are a pain to install. Once on, it works fine.', '[]'::jsonb, NULL, 'admin', true, '2026-07-30T10:15:00+00:00'),

-- ── Product 9: Awei PC-2 3.5mm Wired Earphone ─────────────────
(9, NULL, 'Mithun Das [DEMO]', 4, 'Surprisingly good sound for the price. Bass is punchy, voice clarity is clear on calls. Cable feels durable.', '["https://picsum.photos/seed/demo9a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-16T09:50:00+00:00'),
(9, NULL, 'Rumana Islam [DEMO]', 4, 'Bought as a spare pair. Mic works well for virtual meetings. Great value for money.', '[]'::jsonb, NULL, 'admin', true, '2026-08-06T18:35:00+00:00'),

-- ── Product 10: Baseus Bowie MA10 TWS Wireless Earbuds ─────────
(10, NULL, 'Shakib Alam [DEMO]', 5, 'Pairing is instant, sound quality is balanced and the ANC makes a real difference on the bus. Battery life is excellent.', '["https://picsum.photos/seed/demo10a/400/400", "https://picsum.photos/seed/demo10b/400/400"]'::jsonb, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'admin', true, '2026-07-02T12:30:00+00:00'),
(10, NULL, 'Farzana Haque [DEMO]', 4, 'Comfortable fit for small ears and the case is pocket-friendly. Touch controls take a day to get used to.', '[]'::jsonb, NULL, 'admin', true, '2026-08-18T08:05:00+00:00'),
(10, NULL, 'Zubair Ahmed [DEMO]', 4, 'Great bass and call quality. Battery case charges fast with USB-C. Minor complaint: no wireless charging.', '["https://picsum.photos/seed/demo10c/400/400"]'::jsonb, NULL, 'admin', true, '2026-08-25T20:45:00+00:00'),

-- ── Product 11: JBL GO 4 Portable Bluetooth Speaker ────────────
(11, NULL, 'Tanin Rahman [DEMO]', 5, 'Huge sound from such a tiny speaker! IP67 waterproofing is a lifesaver near the pool. Easily fills a room.', '["https://picsum.photos/seed/demo11a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-20T16:00:00+00:00'),
(11, NULL, 'Shuvo Mandal [DEMO]', 4, 'Great for outdoor trips. Battery lasts about 8 hours which is fine for me. Case quality feels premium.', '[]'::jsonb, NULL, 'admin', true, '2026-08-12T19:15:00+00:00'),

-- ── Product 12: Xiaomi Redmi Watch 5 Active ───────────────────
(12, NULL, 'Adnan Karim [DEMO]', 4, 'Nice big display and accurate step tracking. Notifications work flawlessly with both my phones. Battery around 9 days.', '["https://picsum.photos/seed/demo12a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-11T07:55:00+00:00'),
(12, NULL, 'Sadia Afrin [DEMO]', 5, 'Looks way more expensive than it is. Sleep tracking is surprisingly accurate. Great entry-level smartwatch.', '[]'::jsonb, NULL, 'admin', true, '2026-08-15T13:40:00+00:00'),

-- ── Product 13: Xiaomi Smart Band 9 ────────────────────────────
(13, NULL, 'Rony Chowdhury [DEMO]', 5, 'The AMOLED screen on this band is gorgeous and always-on is a huge upgrade. Battery easily lasts two weeks.', '["https://picsum.photos/seed/demo13a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-24T10:20:00+00:00'),
(13, NULL, 'Moumita Roy [DEMO]', 4, 'Lightweight and barely notice it wearing it. Heart rate and workout tracking are dependable. App works well.', '[]'::jsonb, NULL, 'admin', true, '2026-08-08T17:30:00+00:00'),

-- ── Product 14: Fantech ACGP01 Gamepad Holder ─────────────────
(14, NULL, 'Asif Mahmud [DEMO]', 4, 'Solid grip for long PUBG sessions and makes touch controls feel lighter. Adjustable to fit different phone sizes.', '["https://picsum.photos/seed/demo14a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-06T20:05:00+00:00'),
(14, NULL, 'Sumon Sarkar [DEMO]', 3, 'Does the job but the clamp gets tight on phones with side buttons. Fine for the price otherwise.', '[]'::jsonb, NULL, 'admin', true, '2026-08-03T11:50:00+00:00'),

-- ── Product 15: Fantech K613 Valkyrie RGB Gaming Keyboard ──────
(15, NULL, 'Nishat Rahman [DEMO]', 5, 'Love the hot-swappable switches and the RGB effects are smooth. Typing feels tactile and gaming input is responsive.', '["https://picsum.photos/seed/demo15a/400/400", "https://picsum.photos/seed/demo15b/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-18T14:15:00+00:00'),
(15, NULL, 'Likhon Das [DEMO]', 4, 'Great budget mechanical keyboard. Build is sturdy and the detachable cable is handy. Software is a bit basic.', '[]'::jsonb, NULL, 'admin', true, '2026-08-22T09:35:00+00:00'),

-- ── Product 16: Akaso EK7000 4K Action Camera ─────────────────
(16, NULL, 'Tanzim Alam [DEMO]', 4, '4K at 30fps looks surprisingly good for the price. Image stabilization helps during riding. Battery packs included save you money.', '["https://picsum.photos/seed/demo16a/400/400"]'::jsonb, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'admin', true, '2026-07-21T12:00:00+00:00'),
(16, NULL, 'Fahim Hasan [DEMO]', 3, 'Solid budget action cam, but low-light footage is noisy. With good sunlight it performs much better.', '[]'::jsonb, NULL, 'admin', true, '2026-08-16T15:25:00+00:00'),

-- ── Product 17: Baseus Fiber 1.5L Water Bottle ────────────────
(17, NULL, 'Priya Das [DEMO]', 5, 'Sleek design and super easy to carry. The leak-proof cap works great in my bag. Love the minimalist look.', '["https://picsum.photos/seed/demo17a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-09T08:25:00+00:00'),
(17, NULL, 'Rakibul Islam [DEMO]', 4, 'Good size bottle with a nice grip. Keeps water fresh all day. Would love a bigger lid for ice cubes.', '[]'::jsonb, NULL, 'admin', true, '2026-08-09T18:20:00+00:00'),

-- ── Product 18: Walton Electric Kettle 1.8L ───────────────────
(18, NULL, 'Hasibul Karim [DEMO]', 5, 'Boils 1.8L in no time and the auto shut-off is reliable. Wide mouth makes cleaning easy. Solid build.', '["https://picsum.photos/seed/demo18a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-13T10:30:00+00:00'),
(18, NULL, 'Ayesha Siddiqua [DEMO]', 4, 'Fast and safe for daily chai. Handle stays cool and the cord is long enough. Minor: the lid can be a little stiff getting open.', '[]'::jsonb, NULL, 'admin', true, '2026-08-07T16:45:00+00:00');

-- Repair older demo imports that may have been saved as hidden.
UPDATE public.reviews
SET is_published = true, updated_at = now()
WHERE source = 'admin'
	AND reviewer_name LIKE '%[DEMO]%'
	AND is_published IS DISTINCT FROM true;

-- ────────────────────────────────────────────────────────────────
-- Verify: every product should now show demo reviews on the product
-- page. To remove all demo data later run:
--   DELETE FROM public.reviews WHERE reviewer_name LIKE '%[DEMO]%';
-- ────────────────────────────────────────────────────────────────