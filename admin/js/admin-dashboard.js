/* ─── ADMIN DASHBOARD: stats, activity, AI assistant, renderAll composition ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { STATE, DOM, showToast, escapeHTML, formatPrice } = admin;

    function renderStats() {
        const visits = Number(localStorage.getItem("grabby_visits")) || 0;
        const live = Number(localStorage.getItem("grabby_live")) || 0;
        const cartAdds = Number(localStorage.getItem("grabby_total_cart_adds")) || 0;
        if (DOM.statVisits) DOM.statVisits.textContent = visits;
        if (DOM.statLive) DOM.statLive.textContent = live;
        if (DOM.statCartAdds) DOM.statCartAdds.textContent = cartAdds;
        if (DOM.statProducts) DOM.statProducts.textContent = STATE.products.length;
        if (DOM.liveTrend) DOM.liveTrend.textContent = live ? "Active now" : "No active users";
        if (DOM.productTrend) DOM.productTrend.textContent = `${STATE.products.filter(p => p.inStock).length} in stock`;
        admin.renderOrderStats();
    }

    // ─── CART ACTIVITY ───────────────────────────────────
    const geoCache = {};
    let geoBackfilling = false;

    function countryFlag(countryCode) {
        if (!countryCode || countryCode.length !== 2) return "";
        const code = countryCode.toUpperCase();
        return String.fromCodePoint(...[...code].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
    }

    function isRealIP(ip) {
        return !!(ip && ip !== "Unknown" && !/^anon-/i.test(ip) && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip));
    }

    function resolveIpLocation(ip) {
        if (geoCache[ip]) return Promise.resolve(geoCache[ip]);
        const providers = [
            async () => {
                const res = await fetch(`https://ipapi.co/${ip}/json/`);
                const d = await res.json();
                return (d && !d.error)
                    ? { country: d.country_name || "N/A", countryCode: d.country_code || "", region: d.region || "", city: d.city || "" }
                    : null;
            },
            async () => {
                const res = await fetch(`https://ipwho.is/${ip}`);
                const d = await res.json();
                return (d && d.success)
                    ? { country: d.country || "N/A", countryCode: d.country_code || "", region: d.region || "", city: d.city || "" }
                    : null;
            }
        ];
        return (async () => {
            for (const provider of providers) {
                try {
                    const loc = await provider();
                    if (loc) { geoCache[ip] = loc; return loc; }
                } catch { /* try next provider */ }
            }
            return null;
        })();
    }

    function countryCell(loc) {
        const flag = countryFlag(loc.countryCode);
        const name = escapeHTML(loc.country || "Unknown");
        return flag
            ? `<td class="country-cell"><span class="country-flag" aria-hidden="true">${flag}</span>${name}</td>`
            : `<td class="country-cell">${name}</td>`;
    }

    function activityRow(item) {
        const loc = item.location || {};
        return `<tr><td><span class="ip-value">${escapeHTML(item.ip || "Unknown")}</span></td>${countryCell(loc)}<td><span class="location-value">${escapeHTML([loc.city, loc.region].filter(Boolean).join(", ") || "Unknown")}</span></td><td><span class="product-value">${escapeHTML(item.productTitle || `Product ${item.productId || ""}`)}</span></td><td>${escapeHTML(item.timestamp ? new Date(item.timestamp).toLocaleString() : "Unknown")}</td></tr>`;
    }

    // Re-resolve location for previously recorded rows that have a real IP but
    // missing/N/A location, so Country / Location / flag appear without a manual reset.
    async function backfillActivity(activity) {
        const byIp = new Map();
        for (const item of activity) {
            const loc = item.location || {};
            const empty = !loc.country || loc.country === "N/A" || loc.country === "Unknown";
            if (empty && isRealIP(item.ip)) {
                if (!byIp.has(item.ip)) byIp.set(item.ip, []);
                byIp.get(item.ip).push(item);
            }
        }
        const ips = [...byIp.keys()].slice(0, 20);
        if (!ips.length) return false;
        let changed = false;
        for (const ip of ips) {
            const loc = await resolveIpLocation(ip);
            if (loc) {
                for (const item of byIp.get(ip)) { item.location = loc; changed = true; }
            }
        }
        if (changed) localStorage.setItem("grabby_cart_activity", JSON.stringify(activity));
        return changed;
    }

    async function renderActivity() {
        if (!DOM.activityTableBody) return;
        let activity;
        try { activity = JSON.parse(localStorage.getItem("grabby_cart_activity") || "[]"); } catch { activity = []; }
        if (!activity.length) {
            DOM.activityTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No activity recorded yet.</td></tr>`;
            return;
        }
        activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (!geoBackfilling) {
            geoBackfilling = true;
            try {
                await backfillActivity(activity);
            } catch (e) {
                console.warn("Activity backfill failed:", e);
            } finally {
                geoBackfilling = false;
            }
        }

        DOM.activityTableBody.innerHTML = activity.map(activityRow).join("");
    }

    function renderAll() {
        admin.renderStats();
        if (DOM.adminProductsTable) admin.renderProducts();
        if (DOM.activityTableBody) admin.renderActivity();
        if (DOM.ordersTableBody) admin.renderOrders();
        if (DOM.paymentMethodsAdmin) admin.renderPaymentSettings();
        if (DOM.reviewsTableBody && admin.renderReviews) admin.renderReviews();
    }

    // ─── AI CHAT ────────────────────────────────────────────
    function assistantReply(text) {
        const q = text.toLowerCase();
        if (q.includes("order")) return `You have ${STATE.orders.length} orders total. Use the **Orders** section to filter, update status, and export CSV.`;
        if (q.includes("payment")) return `${STATE.paymentMethods.length} payment method(s) configured under **Payment Settings**.`;
        if (q.includes("revenue")) {
            const stats = admin.computeOrderStats();
            return `Current revenue is ${formatPrice(stats.revenue)} across ${stats.total} orders (${stats.pending} pending, ${stats.delivered} delivered).`;
        }
        if (q.includes("add")) return "Use **Add Product** to create a new product.";
        if (q.includes("edit")) return "Click **Edit** beside a product to load it into the form.";
        if (q.includes("delete")) return "Click **Delete** beside a product and confirm the action.";
        if (q.includes("stock")) return `${STATE.products.filter(p => p.inStock).length} products are currently in stock.`;
        if (q.includes("activity")) return `Cart activity is available under **Cart Activity**.`;
        if (q.includes("review")) return `Reviews are managed under **Custom Reviews**: add custom reviews, photos, YouTube links, and publish/hide or delete them for any product.`;
        return "I can help you manage products, stock, search, editing, deleting, orders, payments, and cart activity.";
    }

    function addChatMessage(type, text) {
        const msg = document.createElement("div");
        msg.className = `chat-message ${type}`;
        msg.textContent = text;
        DOM.aiChatMessages.appendChild(msg);
        DOM.aiChatMessages.scrollTop = DOM.aiChatMessages.scrollHeight;
    }

    async function sendChat() {
        const text = DOM.aiChatInput.value.trim();
        if (!text) return;
        DOM.aiChatInput.value = "";
        addChatMessage("user", text);
        setTimeout(() => addChatMessage("bot", assistantReply(text)), 400);
    }

    function bindChatEvents() {
        DOM.aiChatToggle.addEventListener("click", () => DOM.aiChatPanel.classList.toggle("active"));
        DOM.aiChatClose.addEventListener("click", () => DOM.aiChatPanel.classList.remove("active"));
        DOM.aiChatClear.addEventListener("click", () => {
            DOM.aiChatMessages.innerHTML = "";
            addChatMessage("bot", "Chat cleared.");
        });
        DOM.aiChatSend.addEventListener("click", sendChat);
        DOM.aiChatInput.addEventListener("keydown", e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
        });
    }

    Object.assign(admin, {
        renderStats, renderActivity, renderAll,
        assistantReply, addChatMessage, sendChat, bindChatEvents
    });

})();