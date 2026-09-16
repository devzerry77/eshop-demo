// ─── DEMO CONTACT DOCK (E-Shop Demo) ───────────────────────
// Floating "Like this demo? Contact me" widget on every public page.
// WhatsApp + Facebook buttons with animated high-tech styling.
// Numbers/links can be overridden without code via Supabase `settings`
// rows: contact_whatsapp (digits, e.g. 8801953429090), contact_facebook
// (full URL). Falls back to the defaults below.
import { createClient } from '../supabase/client.js';

const DEFAULTS = {
    whatsappDigits: '8801953429090',
    whatsappDisplay: '01953-429090',
    whatsappText: "Hi! I saw your E-Shop Demo and I'd like a website like that.",
    facebookUrl: 'https://www.facebook.com/profile.php?id=61593180309263',
    facebookDetail: 'facebook.com · E-Shop Demo'
};

(() => {
    if (location.pathname.includes('/admin')) return;
    if (document.getElementById('demoContactDock')) return;

    const state = Object.assign({}, DEFAULTS);

    function waLink() {
        return 'https://wa.me/' + state.whatsappDigits +
            '?text=' + encodeURIComponent(state.whatsappText);
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function build() {
        const dock = document.createElement('div');
        dock.className = 'demo-contact-dock';
        dock.id = 'demoContactDock';
        dock.setAttribute('aria-label', 'Contact the developer');
        dock.innerHTML =
            '<div class="demo-contact-panel" id="demoContactPanel" role="dialog" aria-label="Contact me">' +
                '<div class="demo-contact-head">' +
                    '<div>' +
                        '<div class="demo-contact-eyebrow">Like this demo?</div>' +
                        '<div class="demo-contact-title">Want a website like this?</div>' +
                        '<p class="demo-contact-sub">Contact me directly — I will build yours.</p>' +
                    '</div>' +
                    '<button type="button" class="demo-contact-close" id="demoContactClose" aria-label="Close contact panel">✕</button>' +
                '</div>' +
                '<div class="demo-contact-links">' +
                    '<a class="demo-contact-link whatsapp" id="demoContactWa" href="' + esc(waLink()) + '" target="_blank" rel="noopener">' +
                        '<span class="demo-contact-icon whatsapp">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
                        '</span>' +
                        '<span class="demo-contact-meta">' +
                            '<span class="demo-contact-name">WhatsApp</span>' +
                            '<span class="demo-contact-detail" id="demoContactWaNum">' + esc(state.whatsappDisplay) + '</span>' +
                        '</span>' +
                        '<span class="demo-contact-arrow">→</span>' +
                    '</a>' +
                    '<a class="demo-contact-link facebook" id="demoContactFb" href="' + esc(state.facebookUrl) + '" target="_blank" rel="noopener">' +
                        '<span class="demo-contact-icon facebook">' +
                            '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17.5" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor" font-family="Arial, Helvetica, sans-serif">f</text></svg>' +
                        '</span>' +
                        '<span class="demo-contact-meta">' +
                            '<span class="demo-contact-name">Facebook</span>' +
                            '<span class="demo-contact-detail">' + esc(state.facebookDetail) + '</span>' +
                        '</span>' +
                        '<span class="demo-contact-arrow">→</span>' +
                    '</a>' +
                '</div>' +
                '<p class="demo-contact-note">Tap a button to chat — replies are fast ⚡</p>' +
            '</div>' +
            '<button type="button" class="demo-contact-fab" id="demoContactFab" aria-label="Contact me" aria-expanded="false">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
            '</button>';
        document.body.appendChild(dock);

        const fab = dock.querySelector('#demoContactFab');
        const closeBtn = dock.querySelector('#demoContactClose');

        function setOpen(open) {
            dock.classList.toggle('open', open);
            fab.setAttribute('aria-expanded', String(open));
        }

        fab.addEventListener('click', () => {
            setOpen(!dock.classList.contains('open'));
        });
        closeBtn.addEventListener('click', () => setOpen(false));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') setOpen(false);
        });
        document.addEventListener('click', (e) => {
            if (dock.classList.contains('open') && !dock.contains(e.target)) {
                setOpen(false);
            }
        });

        loadOverrides();
    }

    // Optional admin overrides (Admin → Settings could add these rows):
    // contact_whatsapp = digits only, contact_facebook = full URL.
    async function loadOverrides() {
        try {
            const supabase = createClient();
            if (!supabase) return;
            const { data, error } = await supabase
                .from('settings')
                .select('key,value')
                .in('key', ['contact_whatsapp', 'contact_facebook']);
            if (error || !data) return;
            let changed = false;
            data.forEach(row => {
                if (!row || !row.value) return;
                if (row.key === 'contact_whatsapp' && /^[0-9]{7,15}$/.test(row.value.trim())) {
                    state.whatsappDigits = row.value.trim();
                    state.whatsappDisplay = row.value.trim();
                    changed = true;
                }
                if (row.key === 'contact_facebook' && /^https?:\/\//.test(row.value.trim())) {
                    state.facebookUrl = row.value.trim();
                    changed = true;
                }
            });
            if (changed) {
                const wa = document.getElementById('demoContactWa');
                const num = document.getElementById('demoContactWaNum');
                const fb = document.getElementById('demoContactFb');
                if (wa) wa.href = waLink();
                if (num) num.textContent = state.whatsappDisplay;
                if (fb) fb.href = state.facebookUrl;
            }
        } catch (_) { /* keep defaults */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }
})();
