/* ─── ADMIN ORDERS: order list, status updates, order stats, payment settings ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { STATE, DOM, showToast, escapeHTML, formatPrice, debounce } = admin;

    const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'];
    const PAYMENT_STATUSES = ['pending', 'verified'];
    const EXCLUDED_FROM_REVENUE = ['cancelled', 'returned', 'refunded'];

    function normalizePaymentStatus(value) {
        const v = String(value || 'pending').toLowerCase().trim();
        return v === 'verified' ? 'verified' : 'pending';
    }

    // ─── ORDERS DATA ────────────────────────────────────────
    async function loadOrders() {
        if (!STATE.supabase || STATE.loadingOrders) return;
        STATE.loadingOrders = true;
        try {
            const { data, error } = await STATE.supabase
                .from("orders")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            STATE.orders = (data || []).map(row => ({
                id: row.id,
                order_number: row.order_number || ('#' + row.id),
                user_id: row.user_id || null,
                is_guest: row.is_guest === true || !row.user_id,
                customer_name: row.customer_name || 'Unknown',
                customer_email: row.customer_email || '',
                customer_phone: row.customer_phone || '',
                city: row.city || '',
                state: row.state || '',
                area: row.area || '',
                country: row.country || '',
                total_amount: Number(row.total_amount) || 0,
                discount: Number(row.discount) || 0,
                shipping_cost: Number(row.shipping_cost) || 0,
                payment_method: row.payment_method || '—',
                payment_status: normalizePaymentStatus(row.payment_status),
                status: row.status || 'pending',
                created_at: row.created_at,
                estimated_delivery: row.estimated_delivery || ''
            }));
        } catch (err) {
            showToast("Could not load orders: " + (err.message || err), "error");
        } finally {
            STATE.loadingOrders = false;
        }
        renderOrderStats();
        renderOrders();
    }

    function filteredOrders() {
        let orders = STATE.orders;
        if (STATE.orderStatus && STATE.orderStatus !== "all") {
            orders = orders.filter(o => o.status === STATE.orderStatus);
        }
        const query = STATE.orderQuery.toLowerCase().trim();
        if (query) {
            orders = orders.filter(o =>
                [o.order_number, o.customer_name, o.customer_phone, o.customer_email, o.city]
                    .join(" ").toLowerCase().includes(query)
            );
        }
        return orders;
    }

    function renderOrders() {
        if (!DOM.ordersTableBody) return;
        const orders = filteredOrders();
        const totalPages = Math.max(1, Math.ceil(orders.length / STATE.orderPageSize));
        STATE.orderPage = Math.min(STATE.orderPage, totalPages);
        const start = (STATE.orderPage - 1) * STATE.orderPageSize;
        const items = orders.slice(start, start + STATE.orderPageSize);
        if (!items.length) {
            DOM.ordersTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No orders found.</td></tr>`;
            renderOrdersPagination(totalPages);
            return;
        }
        DOM.ordersTableBody.innerHTML = items.map(o => {
            const paymentStatus = normalizePaymentStatus(o.payment_status);
            const statusOptions = ORDER_STATUSES.map(s =>
                `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s.replace(/_/g, ' ').toUpperCase()}</option>`
            ).join('');
            const paymentOptions = PAYMENT_STATUSES.map(s =>
                `<option value="${s}" ${paymentStatus === s ? 'selected' : ''}>${s.toUpperCase()}</option>`
            ).join('');
            return `<tr data-order-id="${escapeHTML(o.id)}">
                <td><div class="product-name">${escapeHTML(o.order_number)}</div><div class="product-id">${escapeHTML(o.payment_method)}</div>${o.is_guest ? `<div class="product-id"><span class="order-status-pill pending">GUEST</span></div>` : ''}</td>
                <td><strong>${escapeHTML(o.customer_name)}</strong>${o.customer_phone ? `<div class="product-id">${escapeHTML(o.customer_phone)}</div>` : ''}${[o.area, o.city, o.state].filter(Boolean).length ? `<div class="product-id">${escapeHTML([o.area, o.city, o.state].filter(Boolean).join(', '))}</div>` : ''}</td>
                <td><strong>${formatPrice(o.total_amount)}</strong>${o.discount ? `<div class="product-id">-${formatPrice(o.discount)}</div>` : ''}</td>
                <td><span class="order-status-pill ${paymentStatus}">${escapeHTML(paymentStatus.toUpperCase())}</span></td>
                <td><span class="order-status-pill ${escapeHTML(o.status)}">${escapeHTML(o.status.replace(/_/g, ' '))}</span></td>
                <td><div class="product-id">${o.created_at ? escapeHTML(new Date(o.created_at).toLocaleString()) : '—'}</div>${o.estimated_delivery ? `<div class="product-id">ETA ${escapeHTML(o.estimated_delivery)}</div>` : ''}</td>
                <td>
                    <div class="table-actions">
                        <select class="order-status-select payment-status-select" data-payment-status="${escapeHTML(o.id)}" aria-label="Update payment status">${paymentOptions}</select>
                        <select class="order-status-select" data-status="${escapeHTML(o.id)}" aria-label="Update status">${statusOptions}</select>
                        <button class="table-action" data-track="${escapeHTML(o.order_number)}">Track</button>
                    </div>
                </td>
            </tr>`;
        }).join("");
        renderOrdersPagination(totalPages);
    }

    function renderOrdersPagination(totalPages) {
        if (totalPages <= 1) { DOM.ordersPagination.innerHTML = ""; return; }
        let html = "";
        for (let page = 1; page <= totalPages; page++) {
            html += `<button class="${page === STATE.orderPage ? 'active' : ''}" data-opage="${page}">${page}</button>`;
        }
        DOM.ordersPagination.innerHTML = html;
        DOM.ordersPagination.querySelectorAll("[data-opage]").forEach(btn => {
            btn.addEventListener("click", () => {
                STATE.orderPage = Number(btn.dataset.opage);
                renderOrders();
            });
        });
    }

    async function updateOrderStatus(orderId, newStatus) {
        if (!STATE.supabase) return;
        const order = STATE.orders.find(o => String(o.id) === String(orderId));
        if (!order) return;
        const prev = order.status;
        try {
            const { error } = await STATE.supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
            if (error) throw error;
            order.status = newStatus;
            renderOrderStats();
            renderOrders();
            showToast(`Order ${order.order_number} updated to ${newStatus.replace(/_/g, ' ')}.`, "success");
        } catch (err) {
            order.status = prev;
            showToast("Could not update status: " + (err.message || err), "error");
        }
    }

    async function updatePaymentStatus(orderId, newStatus) {
        if (!STATE.supabase) return;
        const normalized = normalizePaymentStatus(newStatus);
        if (newStatus !== normalized) {
            showToast("Invalid payment status. Use PENDING or VERIFIED.", "warning");
            renderOrders();
            return;
        }
        const order = STATE.orders.find(o => String(o.id) === String(orderId));
        if (!order) return;
        const prev = normalizePaymentStatus(order.payment_status);
        if (prev === normalized) return;
        try {
            const { error } = await STATE.supabase.from("orders").update({ payment_status: normalized }).eq("id", orderId);
            if (error) throw error;
            order.payment_status = normalized;
            renderOrders();
            showToast(`Order ${order.order_number} payment ${normalized.toUpperCase()}.`, "success");
        } catch (err) {
            order.payment_status = prev;
            renderOrders();
            showToast("Could not update payment status: " + (err.message || err), "error");
        }
    }

    function computeOrderStats() {
        const orders = STATE.orders;
        const today = new Date().toDateString();
        const total = orders.length;
        const todayCount = orders.filter(o => new Date(o.created_at).toDateString() === today).length;
        const revenue = orders
            .filter(o => !EXCLUDED_FROM_REVENUE.includes(o.status))
            .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        const pending = orders.filter(o => o.status === 'pending').length;
        const delivered = orders.filter(o => o.status === 'delivered').length;
        return { total, today: todayCount, revenue, pending, delivered };
    }

    function renderOrderStats() {
        const stats = computeOrderStats();
        if (DOM.statTotalOrders) DOM.statTotalOrders.textContent = stats.total;
        if (DOM.statTodayOrders) DOM.statTodayOrders.textContent = stats.today;
        if (DOM.statRevenue) DOM.statRevenue.textContent = formatPrice(stats.revenue);
        if (DOM.statPendingOrders) DOM.statPendingOrders.textContent = stats.pending;
        if (DOM.statDeliveredOrders) DOM.statDeliveredOrders.textContent = stats.delivered;
        if (DOM.todayOrdersTrend) DOM.todayOrdersTrend.textContent = stats.today ? 'New since midnight' : 'No new orders today';
    }

    function exportOrdersCSV() {
        const orders = filteredOrders();
        const headers = ['Order Number', 'Guest', 'Customer', 'Email', 'Phone', 'Area/Thana', 'District', 'Division', 'Country', 'Items Total', 'Discount', 'Shipping', 'Payment Method', 'Payment Status', 'Order Status', 'Order Date', 'Estimated Delivery'];
        const rows = orders.map(o => [
            o.order_number, o.is_guest ? 'Yes' : 'No', o.customer_name, o.customer_email, o.customer_phone, o.area, o.city, o.state, o.country,
            o.total_amount, o.discount, o.shipping_cost, o.payment_method, o.payment_status, o.status,
            o.created_at, o.estimated_delivery
        ]);
        admin.exportCSV(headers, rows, 'grabby_orders.csv');
    }

    // ─── PAYMENT SETTINGS ──────────────────────────────────
    async function loadPaymentSettings() {
        if (!STATE.supabase) return;
        try {
            const { data, error } = await STATE.supabase
                .from('payment_settings')
                .select('*')
                .order('display_order', { ascending: true });
            if (error) throw error;
            STATE.paymentMethods = (data || []).map(row => ({
                id: row.id,
                method_name: row.method_name || '',
                enabled: row.enabled !== false,
                status: row.status || 'available',
                fee: Number(row.fee) || 0,
                account_info: row.account_info || {},
                instructions: row.instructions || '',
                qr_code_url: row.qr_code_url || '',
                display_order: Number(row.display_order) || 0
            }));
        } catch (err) {
            showToast("Could not load payment settings: " + (err.message || err), "error");
        }
        renderPaymentSettings();
    }

    function renderPaymentSettings() {
        const container = DOM.paymentMethodsAdmin;
        if (!container) return;
        if (!STATE.paymentMethods.length) {
            container.innerHTML = '<p style="color:var(--text-secondary); padding:10px 0;">No payment methods configured yet.</p>';
            return;
        }
        container.innerHTML = STATE.paymentMethods.map(m => {
            const info = m.account_info || {};
            const detail = [info.number, info.merchant, info.email, info.account].filter(Boolean).join(' · ');
            const label = m.method_name.toLowerCase() === 'cash on delivery' ? 'COD' :
                (info.type ? info.type : (m.method_name || '')).trim();
            return `
                <div class="payment-method-card" data-pmid="${escapeHTML(m.id)}">
                    <span class="pm-status ${m.enabled ? '' : 'unavailable'}">${m.enabled ? 'Enabled' : 'Hidden'}</span>
                    <div class="pm-name">${escapeHTML(m.method_name)} <span class="category-pill">${escapeHTML(label)}</span></div>
                    ${detail ? `<div class="pm-meta">${escapeHTML(detail)}</div>` : ''}
                    <div class="pm-meta">Fee: ${formatPrice(m.fee)} · Status: ${escapeHTML(m.status.replace(/_/g, ' '))}</div>
                    ${m.instructions ? `<div class="pm-meta" style="white-space:pre-line;">${escapeHTML(m.instructions)}</div>` : ''}
                    ${m.qr_code_url ? `<img src="${escapeHTML(m.qr_code_url)}" alt="QR" style="width:64px; height:64px; object-fit:contain; border:1px solid var(--border); border-radius:6px;">` : ''}
                    <div class="pm-actions">
                        <button class="table-action" data-pmedit="${escapeHTML(m.id)}">Edit</button>
                        <button class="table-action delete" data-pmdelete="${escapeHTML(m.id)}">Delete</button>
                        <button class="table-action" data-pmtoggle="${escapeHTML(m.id)}">${m.enabled ? 'Disable' : 'Enable'}</button>
                    </div>
                </div>
            `;
        }).join("");
    }

    function openPaymentForm(method) {
        STATE.editingPayment = method ? method.id : null;
        DOM.pmId.value = method ? method.id : '';
        const info = (method && method.account_info) || {};
        DOM.pmFormTitle.textContent = method ? 'Edit Payment Method' : 'Add Payment Method';
        DOM.pmName.value = method ? method.method_name : '';
        DOM.pmType.value = info.type || 'mobile';
        DOM.pmNumber.value = info.number || '';
        DOM.pmMerchant.value = info.merchant || '';
        DOM.pmEmail.value = info.email || '';
        DOM.pmAccount.value = info.account || '';
        DOM.pmInstructions.value = method ? (method.instructions || '') : '';
        DOM.pmQr.value = method ? (method.qr_code_url || '') : '';
        DOM.pmFee.value = method ? (method.fee || 0) : 0;
        DOM.pmOrder.value = method ? (method.display_order || 1) : (STATE.paymentMethods.length + 1);
        DOM.pmEnabled.checked = method ? method.enabled !== false : true;
        DOM.pmStatus.value = method ? (method.status || 'available') : 'available';
        DOM.paymentFormArea.style.display = 'grid';
        DOM.paymentFormArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closePaymentForm() {
        STATE.editingPayment = null;
        DOM.paymentFormArea.style.display = 'none';
    }

    async function savePaymentMethod() {
        const name = DOM.pmName.value.trim();
        if (!name) { showToast("Method name is required.", "warning"); DOM.pmName.focus(); return; }
        if (STATE.savingPayment) return;
        const payload = {
            method_name: name,
            enabled: DOM.pmEnabled.checked,
            status: DOM.pmStatus.value,
            fee: Number(DOM.pmFee.value) || 0,
            account_info: {
                type: DOM.pmType.value,
                number: DOM.pmNumber.value.trim(),
                merchant: DOM.pmMerchant.value.trim(),
                email: DOM.pmEmail.value.trim(),
                account: DOM.pmAccount.value.trim()
            },
            instructions: DOM.pmInstructions.value.trim(),
            qr_code_url: DOM.pmQr.value.trim(),
            display_order: Number(DOM.pmOrder.value) || 0
        };
        STATE.savingPayment = true;
        try {
            let error = null;
            if (STATE.editingPayment) {
                const res = await STATE.supabase.from('payment_settings').update(payload).eq('id', STATE.editingPayment);
                error = res.error;
            } else {
                const res = await STATE.supabase.from('payment_settings').insert(payload).select().single();
                error = res.error;
            }
            if (error) throw error;
            showToast('Payment method saved!', 'success');
            closePaymentForm();
            await loadPaymentSettings();
        } catch (err) {
            showToast('Could not save payment method: ' + (err.message || err), 'error');
        } finally {
            STATE.savingPayment = false;
        }
    }

    async function deletePaymentMethod(id) {
        if (!confirm('Delete this payment method?')) return;
        try {
            const { error } = await STATE.supabase.from('payment_settings').delete().eq('id', id);
            if (error) throw error;
            showToast('Payment method deleted.', 'success');
            await loadPaymentSettings();
        } catch (err) {
            showToast('Could not delete: ' + (err.message || err), 'error');
        }
    }

    async function togglePaymentMethod(id) {
        const method = STATE.paymentMethods.find(m => String(m.id) === String(id));
        if (!method) return;
        try {
            const { error } = await STATE.supabase
                .from('payment_settings')
                .update({ enabled: method.enabled ? false : true })
                .eq('id', id);
            if (error) throw error;
            method.enabled = !method.enabled;
            renderPaymentSettings();
            showToast(`${method.method_name} ${method.enabled ? 'enabled' : 'disabled'}.`, 'success');
        } catch (err) {
            showToast('Could not update: ' + (err.message || err), 'error');
        }
    }

    // ─── EVENTS ─────────────────────────────────────────────
    function bindOrdersEvents() {
        DOM.exportOrdersBtn?.addEventListener("click", exportOrdersCSV);

        DOM.orderStatusFilter?.addEventListener("change", () => {
            STATE.orderStatus = DOM.orderStatusFilter.value;
            STATE.orderPage = 1;
            renderOrders();
        });

        DOM.orderSearchInput?.addEventListener("input", debounce(e => {
            STATE.orderQuery = e.target.value;
            STATE.orderPage = 1;
            renderOrders();
        }, 300));

        DOM.ordersTableBody?.addEventListener("change", e => {
            const paymentSelect = e.target.closest("[data-payment-status]");
            if (paymentSelect) {
                updatePaymentStatus(paymentSelect.dataset.paymentStatus, paymentSelect.value);
                return;
            }
            const select = e.target.closest("[data-status]");
            if (select) updateOrderStatus(select.dataset.status, select.value);
        });

        DOM.ordersTableBody?.addEventListener("click", e => {
            const track = e.target.closest("[data-track]");
            if (track) {
                const url = `../order-tracking.html?order_id=${encodeURIComponent(track.dataset.track)}`;
                window.open(url, '_blank');
            }
        });
    }

    function bindPaymentsEvents() {
        DOM.addPaymentBtn?.addEventListener("click", () => openPaymentForm(null));
        DOM.savePaymentBtn?.addEventListener("click", savePaymentMethod);
        DOM.cancelPaymentBtn?.addEventListener("click", closePaymentForm);

        DOM.paymentMethodsAdmin?.addEventListener("click", e => {
            const edit = e.target.closest("[data-pmedit]");
            const del = e.target.closest("[data-pmdelete]");
            const toggle = e.target.closest("[data-pmtoggle]");
            if (edit) {
                const method = STATE.paymentMethods.find(m => String(m.id) === String(edit.dataset.pmedit));
                if (method) openPaymentForm(method);
            }
            if (del) deletePaymentMethod(del.dataset.pmdelete);
            if (toggle) togglePaymentMethod(toggle.dataset.pmtoggle);
        });
    }

    Object.assign(admin, {
        loadOrders, filteredOrders, renderOrders, updateOrderStatus, updatePaymentStatus,
        computeOrderStats, renderOrderStats, exportOrdersCSV,
        loadPaymentSettings, renderPaymentSettings, openPaymentForm, closePaymentForm,
        savePaymentMethod, deletePaymentMethod, togglePaymentMethod,
        bindOrdersEvents, bindPaymentsEvents
    });

})();