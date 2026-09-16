// ─── MY ACCOUNT / PROFILE PAGE ───────────────────────────
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';
import { createClient } from '../supabase/client.js';
import { showToast } from '../components/toast.js';
import { createAddressSelects } from '../components/address-selects.js';

const TOAST_ID = 'profileToast';

function showToastMsg(msg) {
    showToast(TOAST_ID, msg, 2000);
}

function firstNameOf(user) {
    const full = ((user && user.user_metadata && user.user_metadata.full_name) || '').trim();
    if (full) return full;
    const email = (user && user.email) || '';
    return email.replace(/@.*$/, '') || 'Account';
}

function initialsOf(name) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    const letters = parts.map((p) => (p[0] || '').toUpperCase()).join('');
    return letters || 'G';
}

function renderSignedOut(supabase) {
    const el = document.getElementById('profileContent');
    el.innerHTML = `
        <div class="empty-orders">
            <div class="icon">🔐</div>
            <h2>Please Login</h2>
            <p>Sign in to access your profile and orders.</p>
            <div style="display:flex; gap:0.8rem; justify-content:center; flex-wrap:wrap; margin-top:1rem;">
                <a href="login.html" class="button button-primary">Sign In</a>
                <a href="index.html" class="button">Continue Shopping</a>
            </div>
        </div>
    `;
}

function formatAddress(addr) {
    const parts = [
        [addr.name, addr.phone].filter(Boolean).join(', '),
        addr.address_line1,
        addr.address_line2,
        [addr.area, addr.city, addr.state].filter(Boolean).join(', '),
        addr.country
    ].filter(Boolean);
    return parts.join('<br>');
}

async function loadUserAddresses(supabase, userId) {
    const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
    if (error) {
        console.warn('Failed to load addresses', error);
        return [];
    }
    return data || [];
}

function renderAddressBook(supabase, user) {
    const slot = document.getElementById('addressBookSlot');
    if (!slot) return;
    slot.innerHTML = `
        <div class="profile-address-section">
            <div class="profile-section-head">
                <h2>Delivery Addresses</h2>
                <button type="button" class="button button-secondary" id="addAddressBtn">+ Add New Address</button>
            </div>
            <div id="addressList" class="address-list"><p class="profile-loading">Loading addresses...</p></div>
            <div id="addressFormWrap"></div>
        </div>
    `;

    const renderList = async () => {
        const list = document.getElementById('addressList');
        const addresses = await loadUserAddresses(supabase, user.id);
        if (!addresses.length) {
            list.innerHTML = `<div class="empty-orders" style="padding:2.5rem 0;">
                <div class="icon" style="font-size:2rem;">📦</div>
                <p>No saved addresses yet. Add one so checkout can use it automatically.</p>
            </div>`;
            return;
        }
        list.innerHTML = addresses.map(addr => `
            <div class="address-card ${addr.is_default ? 'default' : ''}">
                ${addr.is_default ? '<span class="address-badge">DEFAULT</span>' : ''}
                <div class="address-card-body">
                    <div class="address-card-text">${formatAddress(addr)}</div>
                    <div class="address-actions">
                        ${!addr.is_default ? `<button type="button" class="button button-secondary btn-sm" data-action="default" data-id="${addr.id}">Set as default</button>` : '<span class="address-default-note">Default address</span>'}
                        <button type="button" class="button button-secondary btn-sm" data-action="edit" data-id="${addr.id}">Edit</button>
                        <button type="button" class="button btn-sm btn-danger" data-action="delete" data-id="${addr.id}">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');

        list.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => handleAddressAction(supabase, user, btn.dataset.action, btn.dataset.id, renderList));
        });
    };

    document.getElementById('addAddressBtn').addEventListener('click', () => openAddressForm(supabase, user, null, renderList));
    renderList();
}

function addressFormHtml(addr) {
    const a = addr || {};
    return `
        <div class="address-form">
            <h3>${addr ? 'Edit Address' : 'Add New Address'}</h3>
            <div class="field">
                <label>Full Name *</label>
                <input type="text" id="addrName" placeholder="John Doe" value="${a.name || ''}" required>
            </div>
            <div class="field">
                <label>Phone *</label>
                <input type="tel" id="addrPhone" placeholder="017XXXXXXXX" value="${a.phone || ''}" required>
            </div>
            <div class="field">
                <label>Address Line 1 *</label>
                <input type="text" id="addrAddress1" placeholder="House #, Street" value="${a.address_line1 || ''}" required>
            </div>
            <div class="field">
                <label>Address Line 2</label>
                <input type="text" id="addrAddress2" placeholder="Apartment, floor (optional)" value="${a.address_line2 || ''}">
            </div>
            <div id="addrSelects"></div>
            <div class="field">
                <label>Country *</label>
                <input type="text" id="addrCountry" value="${a.country || 'Bangladesh'}" required>
            </div>
            <label style="display:flex; align-items:center; gap:8px; font-weight:500; margin:0.75rem 0 1rem;">
                <input type="checkbox" id="addrDefault" ${a.is_default ? 'checked' : ''}> Set as my default address
            </label>
            <div style="display:flex; gap:0.8rem; flex-wrap:wrap;">
                <button type="button" class="button button-primary" id="saveAddrBtn">${addr ? 'Save Changes' : 'Save Address'}</button>
                <button type="button" class="button" id="cancelAddrBtn">Cancel</button>
            </div>
        </div>
    `;
}

function openAddressForm(supabase, user, addr, renderList) {
    const wrap = document.getElementById('addressFormWrap');
    if (!wrap) return;
    wrap.innerHTML = addressFormHtml(addr);

    const selects = createAddressSelects(document.getElementById('addrSelects'), {
        division: addr ? addr.state : '',
        district: addr ? addr.city : '',
        area: addr ? addr.area : ''
    });

    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });

    document.getElementById('cancelAddrBtn').addEventListener('click', () => { wrap.innerHTML = ''; });

    document.getElementById('saveAddrBtn').addEventListener('click', async () => {
        const loc = selects.getValues();
        const payload = {
            user_id: user.id,
            name: document.getElementById('addrName').value.trim(),
            phone: document.getElementById('addrPhone').value.trim(),
            address_line1: document.getElementById('addrAddress1').value.trim(),
            address_line2: document.getElementById('addrAddress2').value.trim(),
            state: loc.division,
            city: loc.district,
            area: loc.area,
            country: document.getElementById('addrCountry').value.trim(),
            is_default: document.getElementById('addrDefault').checked
        };
        if (!payload.name || !payload.phone || !payload.address_line1 || !payload.city || !payload.country) {
            showToastMsg('Please fill all required fields.');
            return;
        }
        try {
            if (addr && addr.id) {
                await supabase.from('addresses').update(payload).eq('id', addr.id);
                if (payload.is_default) await clearOtherDefaults(supabase, user.id, addr.id);
            } else {
                const { data: existing } = await supabase
                    .from('addresses').select('id').eq('user_id', user.id);
                if (!existing || !existing.length) payload.is_default = true;
                const { data: inserted } = await supabase.from('addresses').insert(payload).select('id').single();
                if (payload.is_default) await clearOtherDefaults(supabase, user.id, inserted.id);
            }
            showToastMsg(addr ? 'Address updated' : 'Address saved');
            wrap.innerHTML = '';
            renderList();
        } catch (e) {
            console.error('Failed to save address', e);
            showToastMsg('Failed to save address.');
        }
    });
}

async function clearOtherDefaults(supabase, userId, keepId) {
    const { data } = await supabase.from('addresses').select('id').eq('user_id', userId);
    if (!data) return;
    const others = data.filter(a => String(a.id) !== String(keepId));
    for (const other of others) {
        await supabase.from('addresses').update({ is_default: false }).eq('id', other.id);
    }
}

async function handleAddressAction(supabase, user, action, id, renderList) {
    if (action === 'delete') {
        if (!confirm('Delete this address?')) return;
        try {
            await supabase.from('addresses').delete().eq('id', id);
            showToastMsg('Address deleted');
            renderList();
        } catch (e) {
            showToastMsg('Failed to delete address.');
        }
        return;
    }
    if (action === 'default') {
        try {
            await supabase.from('addresses').update({ is_default: true }).eq('id', id);
            await clearOtherDefaults(supabase, user.id, id);
            showToastMsg('Default address updated');
            renderList();
        } catch (e) {
            showToastMsg('Failed to update default address.');
        }
        return;
    }
    if (action === 'edit') {
        const { data } = await supabase.from('addresses').select('*').eq('id', id).single();
        if (data) openAddressForm(supabase, user, data, renderList);
    }
}

function renderAccountSettings(supabase, user) {
    const slot = document.getElementById('accountSettingsSlot');
    if (!slot) return;
    const providers = (user.app_metadata && user.app_metadata.provider) || [];
    const isGoogleUser = providers.includes('google');
    const email = user.email || '';

    slot.innerHTML = `
        <div class="account-settings">
            <h2>Account Settings</h2>
            ${isGoogleUser
                ? `<div class="auth-provider-note">
                       <strong>Google Account:</strong> Your password is managed by Google and cannot be changed here. To update your password, please visit your Google account settings.
                   </div>`
                : `<div class="auth-form" id="passwordChangeForm">
                       <h3>Change Password</h3>
                       <div class="field"><label for="currentPassword">Current Password *</label><input type="password" id="currentPassword" autocomplete="current-password" /></div>
                       <div class="field"><label for="newPassword">New Password *</label><input type="password" id="newPassword" autocomplete="new-password" /></div>
                       <div class="field"><label for="confirmPassword">Confirm New Password *</label><input type="password" id="confirmPassword" autocomplete="new-password" /></div>
                       <div class="form-error" id="passwordError"></div>
                       <div class="form-success" id="passwordSuccess"></div>
                       <div class="form-btn-row"><button type="button" class="button button-primary btn-save" id="savePasswordBtn">Update Password</button></div>
                   </div>`
            }
            <div class="auth-form" id="emailChangeForm" style="margin-top:1rem;">
                <h3>Change Email</h3>
                <div class="field"><label>Current Email</label><input type="email" value="${email}" disabled style="opacity:0.7; cursor:default;" /></div>
                <div class="field"><label for="newEmail">New Email *</label><input type="email" id="newEmail" autocomplete="email" /></div>
                <div class="form-error" id="emailError"></div>
                <div class="form-success" id="emailSuccess"></div>
                <div class="form-btn-row"><button type="button" class="button button-primary btn-save" id="saveEmailBtn">Update Email</button></div>
            </div>
        </div>
    `;

    if (!isGoogleUser) {
        const savePwdBtn = document.getElementById('savePasswordBtn');
        if (savePwdBtn) savePwdBtn.addEventListener('click', async () => {
            const errEl = document.getElementById('passwordError');
            const okEl = document.getElementById('passwordSuccess');
            const cur = (document.getElementById('currentPassword') || {}).value || '';
            const pwd = (document.getElementById('newPassword') || {}).value || '';
            const cfm = (document.getElementById('confirmPassword') || {}).value || '';
            if (errEl) errEl.textContent = '';
            if (okEl) okEl.textContent = '';
            if (!cur) { if (errEl) errEl.textContent = 'Please enter your current password.'; return; }
            if (pwd.length < 6) { if (errEl) errEl.textContent = 'Password must be at least 6 characters long.'; return; }
            if (pwd !== cfm) { if (errEl) errEl.textContent = 'New passwords do not match.'; return; }
            if (pwd === cur) { if (errEl) errEl.textContent = 'New password must be different from your current password.'; return; }
            savePwdBtn.disabled = true;
            savePwdBtn.textContent = 'Updating…';
            try {
                const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: cur });
                if (authErr) {
                    if (errEl) errEl.textContent = 'Current password is incorrect.';
                    savePwdBtn.disabled = false;
                    savePwdBtn.textContent = 'Update Password';
                    return;
                }
                const { error } = await supabase.auth.updateUser({ password: pwd });
                if (error) {
                    if (errEl) errEl.textContent = error.message || 'Failed to update password.';
                } else {
                    if (okEl) okEl.textContent = 'Password updated successfully.';
                    const f = document.getElementById('currentPassword'); if (f) f.value = '';
                    const n = document.getElementById('newPassword'); if (n) n.value = '';
                    const c = document.getElementById('confirmPassword'); if (c) c.value = '';
                }
            } catch (e) {
                if (errEl) errEl.textContent = 'Something went wrong. Please try again.';
            }
            savePwdBtn.disabled = false;
            savePwdBtn.textContent = 'Update Password';
        });
    }

    const saveEmailBtn = document.getElementById('saveEmailBtn');
    if (saveEmailBtn) saveEmailBtn.addEventListener('click', async () => {
        const errEl = document.getElementById('emailError');
        const okEl = document.getElementById('emailSuccess');
        const newEmail = ((document.getElementById('newEmail') || {}).value || '').trim();
        if (errEl) errEl.textContent = '';
        if (okEl) okEl.textContent = '';
        if (!newEmail) { if (errEl) errEl.textContent = 'Please enter a new email address.'; return; }
        if (newEmail.toLowerCase() === email.toLowerCase()) { if (errEl) errEl.textContent = 'New email must be different from your current email.'; return; }
        saveEmailBtn.disabled = true;
        saveEmailBtn.textContent = 'Updating…';
        try {
            const { error } = await supabase.auth.updateUser({ email: newEmail });
            if (error) {
                if (errEl) errEl.textContent = error.message || 'Failed to update email.';
            } else {
                if (okEl) okEl.textContent = 'A verification link has been sent to your new email address. Please check your inbox and confirm the change.';
                const f = document.getElementById('newEmail'); if (f) f.value = '';
            }
        } catch (e) {
            if (errEl) errEl.textContent = 'Something went wrong. Please try again.';
        }
        saveEmailBtn.disabled = false;
        saveEmailBtn.textContent = 'Update Email';
    });
}

function renderSignedIn(supabase, user) {
    const name = firstNameOf(user);
    const email = user.email || '';
    const el = document.getElementById('profileContent');
    el.innerHTML = `
        <div class="profile-card">
            <div class="profile-avatar">${initialsOf(name)}</div>
            <div class="profile-details">
                <h1 class="profile-name">${name}</h1>
                <p class="profile-email">${email}</p>
            </div>
            <div class="profile-actions">
                <a href="my-orders.html" class="button button-primary">My Orders</a>
                <button type="button" class="button" id="logoutBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Logout</button>
                <a href="index.html" class="button">Continue Shopping</a>
            </div>
        </div>
        <div id="addressBookSlot"></div>
        <div id="accountSettingsSlot"></div>
    `;
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        if (!supabase) {
            showToastMsg('Logout failed');
            return;
        }
        try {
            await supabase.auth.signOut();
            renderProfile();
        } catch (e) {
            showToastMsg('Logout failed');
        }
    });
    renderAddressBook(supabase, user);
    renderAccountSettings(supabase, user);
}

async function renderProfile() {
    const supabase = createClient();
    if (!supabase) {
        renderSignedOut();
        return;
    }
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            renderSignedIn(supabase, user);
        } else {
            renderSignedOut();
        }
    } catch (e) {
        renderSignedOut();
    }
}

// ─── INIT ───────────────────────────────────────────────
loadTheme();
loadSitePalette();
document.addEventListener('storage', (e) => { if (e.key === 'eshop_theme') loadTheme(); });
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

renderProfile();