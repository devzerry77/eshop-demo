// ─── CHATBOT / HELP WIDGET ─────────────────────────────────
// Floating help button for the public site. Uses assets/logos/chatbot logo.svg.
// Shows a friendly welcome message, quick help options and a
// "Contact With Us" button that opens the link the admin saved in
// Admin → Settings → Messenger / Chat (settings table key "messenger_link").
import { createClient } from '../supabase/client.js';

(() => {
    if (location.pathname.includes('/admin')) return;
    if (document.getElementById('chatbotWidget')) return;

    const MESSENGER_KEY = 'messenger_link';
    let messengerLink = localStorage.getItem('eshop_messenger_link') || '';

    const HELP_OPTIONS = [
        {
            key: 'product',
            label: '🛍️ Product Information',
            reply: 'You can browse the full catalog to see the latest gadgets and deals. Use the search bar to find a specific product, open it, and check its photos, specifications and price. Need more details? Chat with us on Messenger anytime.'
        },
        {
            key: 'order',
            label: '🚚 Order / Delivery Help',
            reply: 'You can track your order on the My Orders or Order Tracking pages using your order number. We deliver across Bangladesh — free delivery above the free-delivery threshold, and 7-day easy returns.'
        },
        {
            key: 'payment',
            label: '💳 Payment Help',
            reply: 'We accept bKash, Nagad, Rocket, Upay, major cards and Cash on Delivery. Your chosen payment method is shown at checkout with full instructions to complete the payment.'
        },
        {
            key: 'return',
            label: '↩️ Return / Refund',
            reply: 'Every product comes with a 7-day easy return policy. If something is not right, reach out to us on Messenger with your order number and we will arrange a return or refund quickly.'
        }
    ];

    const INTRO = [
        'Hi! 👋 Welcome to E-Shop Demo 🛍️ Great to have you here!',
        'Hi, is delivery free on all gadgets? 🙂',
        'Free delivery across Bangladesh above our threshold, plus 7-day easy returns! 🚚 Pick an option below for details 👇'
    ];

    function buildWidget() {
        const widget = document.createElement('div');
        widget.className = 'chatbot-widget';
        widget.id = 'chatbotWidget';
        widget.setAttribute('aria-label', 'Help chat');

        const panel = document.createElement('div');
        panel.className = 'chatbot-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'E-Shop Demo help chat');
        panel.innerHTML = `
            <div class="chatbot-head">
                <div class="chatbot-head-persona">
                    <img class="chatbot-head-avatar" src="assets/logos/chatbot logo.svg" alt="E-Shop Demo">
                    <div class="chatbot-head-title">
                        <strong>E-Shop Demo Support</strong>
                        <span class="chatbot-head-status"><i></i>Online — replies in minutes</span>
                    </div>
                </div>
                <button type="button" class="chatbot-close" id="chatbotClose" aria-label="Close chat">✕</button>
            </div>
            <div class="chatbot-body" id="chatbotBody">
                <div class="chatbot-day"><span>Today</span></div>
                <div class="chatbot-options" id="chatbotOptions" hidden>
                    ${HELP_OPTIONS.map(o => `<button type="button" class="chatbot-option" data-option="${o.key}">${o.label}</button>`).join('')}
                </div>
                <div class="chatbot-reply" id="chatbotReply" hidden></div>
            </div>
            <div class="chatbot-footer">
                <form class="chatbot-input-row" id="chatbotForm">
                    <input class="chatbot-input" id="chatbotInput" type="text" placeholder="Type a message…" autocomplete="off" aria-label="Type a message">
                    <button type="submit" class="chatbot-send" id="chatbotSend" aria-label="Send message">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M2.5 21l19-9-19-9v7l13.5 2L2.5 14v7z"/></svg>
                    </button>
                </form>
            </div>
        `;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'chatbot-toggle';
        toggle.id = 'chatbotToggle';
        toggle.setAttribute('aria-label', 'Open help chat');
        toggle.innerHTML = `<img class="chatbot-toggle-img" src="assets/logos/chatbot logo.svg" alt="">`;

        widget.appendChild(panel);
        widget.appendChild(toggle);
        document.body.appendChild(widget);

        bindEvents(widget, panel, toggle);
        fetchMessengerLink();
    }

    function bindEvents(widget, panel, toggle) {
        const body = widget.querySelector('#chatbotBody');
        const options = widget.querySelector('#chatbotOptions');
        const reply = widget.querySelector('#chatbotReply');
        const form = widget.querySelector('#chatbotForm');
        const input = widget.querySelector('#chatbotInput');

        let introPlayed = false;
        const wait = ms => new Promise(r => setTimeout(r, ms));
        // Smoothly keep the newest content visible. Deferred to a double
        // rAF so the new nodes have actually rendered (and scrollHeight is
        // final) before scrolling. Only the chat body scrolls — never the page.
        const scrollChat = () => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
            }));
        };

        toggle.addEventListener('click', () => {
            const open = panel.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(open));
            document.body.classList.toggle('chatbot-open', open);
            if (open) {
                if (!introPlayed) { introPlayed = true; playIntro(); }
            }
        });
        widget.querySelector('#chatbotClose').addEventListener('click', () => {
            panel.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('chatbot-open');
        });

        options.addEventListener('click', e => {
            const btn = e.target.closest('[data-option]');
            if (!btn) return;
            const item = HELP_OPTIONS.find(o => o.key === btn.dataset.option);
            if (!item) return;
            // Keep the help-options section (4 options + Contact With Us, which
            // lives inside #chatbotOptions) visible below the reply so Contact
            // stays available and scrolls naturally with the options list.
            body.appendChild(reply);
            reply.hidden = false;
            reply.innerHTML = `
                <div class="chatbot-msg chatbot-msg-user">${item.label}</div>
                <div class="chatbot-msg chatbot-msg-bot">${item.reply}</div>
                <button type="button" class="chatbot-back" id="chatbotBack">← Back to help options</button>
            `;
            reply.querySelector('#chatbotBack').addEventListener('click', () => {
                reply.hidden = true;
                body.appendChild(options);
                options.hidden = false;
                scrollChat();
            });
            scrollChat();
        });

        form.addEventListener('submit', e => {
            e.preventDefault();
            if (input.disabled) return;
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            options.hidden = true;
            reply.hidden = true;
            appendMsg('user', text);
            showTyping();
            setTimeout(() => {
                removeTyping();
                appendMsg('bot', 'Thanks for your message! 🙌 A real support agent usually replies on Messenger within minutes. Tap the button below to chat with our team directly.');
                scrollChat();
            }, 1000 + Math.random() * 700);
            scrollChat();
        });

        async function playIntro() {
            input.disabled = true;
            await typeBot(INTRO[0]);
            await wait(240);
            await typeUser(INTRO[1]);
            await wait(300);
            await typeBot(INTRO[2]);
            await wait(240);
            revealOptions();
            await wait(200);
            showContactBtn();
            await wait(150);
            input.disabled = false;
            scrollChat();
        }

        async function typeBot(text) {
            showTyping();
            await wait(650 + Math.random() * 350);
            removeTyping();
            scrollChat();
            const node = appendMsg('bot', '');
            await typeOut(node, text);
            scrollChat();
        }

        async function typeUser(text) {
            const node = appendMsg('user', '');
            await typeOut(node, text);
            scrollChat();
        }

        function showContactBtn() {
            const wrap = document.createElement('div');
            wrap.className = 'chatbot-contact-wrap';
            const btn = document.createElement('a');
            btn.className = 'chatbot-contact-btn';
            btn.innerHTML = '<img class="chatbot-contact-icon" src="assets/logos/chatbot logo.svg" alt=""> Contact With Us';
            btn.target = '_blank';
            btn.rel = 'noopener';
            if (messengerLink) {
                btn.href = messengerLink;
            } else {
                btn.href = '#';
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    const msg = document.createElement('div');
                    msg.className = 'chatbot-msg chatbot-msg-bot';
                    msg.textContent = 'Our contact link is not set up yet. Please use the help options below or try again later.';
                    wrap.after(msg);
                    scrollChat();
                });
            }
            wrap.appendChild(btn);
            // Permanently part of the help-options area: moves, shows, hides
            // and scrolls together with the 4 option buttons. Never duplicated.
            options.appendChild(wrap);
            scrollChat();
        }

        function revealOptions() {
            body.appendChild(options);
            const btns = Array.from(options.querySelectorAll('.chatbot-option'));
            options.hidden = false;
            btns.forEach(b => { b.style.opacity = '0'; });
            btns.forEach((b, idx) => setTimeout(() => {
                b.classList.add('chatbot-option-reveal');
                b.style.opacity = '';
                scrollChat();
            }, idx * 180));
        }

        function typeOut(node, text) {
            return new Promise(resolve => {
                const chars = Array.from(text);
                let i = 0;
                const tick = () => {
                    if (i > chars.length) {
                        node.textContent = text;
                        resolve();
                        return;
                    }
                    node.textContent = chars.slice(0, i).join('');
                    i += 1;
                    if (i % 3 === 0) scrollChat();
                    const delay = i >= chars.length - 4 ? 0.65 : 1;
                    setTimeout(tick, (15 + Math.random() * 24) * delay);
                };
                tick();
            });
        }

        function appendMsg(role, text) {
            const node = document.createElement('div');
            node.className = 'chatbot-msg ' + (role === 'user' ? 'chatbot-msg-user' : 'chatbot-msg-bot');
            if (text) node.textContent = text;
            body.appendChild(node);
            return node;
        }

        function showTyping() {
            const t = document.createElement('div');
            t.className = 'chatbot-typing';
            t.setAttribute('aria-label', 'E-Shop Demo is typing');
            t.innerHTML = '<span></span><span></span><span></span>';
            body.appendChild(t);
            scrollChat();
        }

        function removeTyping() {
            const t = body.querySelector('.chatbot-typing');
            if (t) t.remove();
        }
    }

    async function fetchMessengerLink() {
        try {
            const supabase = createClient();
            if (!supabase) return;
            const { data, error } = await supabase.from('settings').select('*').eq('key', MESSENGER_KEY);
            if (error || !data || !data.length) return;
            const value = (data[0] && data[0].value) || '';
            if (!value) return;
            messengerLink = value;
            try { localStorage.setItem('eshop_messenger_link', value); } catch (e) { /* noop */ }
        } catch (e) { /* keep cached link */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildWidget);
    } else {
        buildWidget();
    }
})();