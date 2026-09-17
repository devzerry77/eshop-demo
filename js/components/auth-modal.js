// ─── AUTH MODAL COMPONENT ─────────────────────────────────
// Premium sign-in / sign-up dialog backed by the existing
// Supabase authentication system (Google OAuth + email/password).
// Used by the checkout page before a purchase can continue.
import { createClient } from '../supabase/client.js';

const RETURN_KEY = 'eshop_auth_return';

const FRIENDLY_ERRORS = {
    invalidCredentials: 'Email or password is incorrect.',
    invalidEmail: 'Please enter a valid email address.',
    emailNotConfirmed: 'Please confirm your email address before signing in.',
    userExists: 'An account with this email already exists. Please sign in instead.',
    weakPassword: 'Password must be at least 6 characters long.',
    signupDisabled: 'New registrations are currently disabled. Please try again later.',
    providerDisabled: "Google sign-in isn't set up for this store yet. Please sign in with your email instead.",
    rateLimit: 'Too many attempts. Please try again in a moment.',
    network: 'Network error. Please check your connection and try again.',
    generic: 'Unable to complete this request. Please try again.'
};

function friendlyError(err) {
    const msg = ((err && (err.message || err.error_description || err.msg)) || '').toString().toLowerCase();
    if (!msg) return FRIENDLY_ERRORS.generic;
    if (msg.includes('invalid login credentials') || msg.includes('invalid email or password') || msg.includes('invalid grant')) {
        return FRIENDLY_ERRORS.invalidCredentials;
    }
    if (msg.includes('invalid email') || msg.includes('email should be')) return FRIENDLY_ERRORS.invalidEmail;
    if (msg.includes('email not confirmed')) return FRIENDLY_ERRORS.emailNotConfirmed;
    if (msg.includes('already registered') || msg.includes('user already exists') || msg.includes('user_already_exists')) {
        return FRIENDLY_ERRORS.userExists;
    }
    if (msg.includes('weak password') || msg.includes('at least 6 characters')) return FRIENDLY_ERRORS.weakPassword;
    if (msg.includes('signup disabled') || msg.includes('signups not allowed')) return FRIENDLY_ERRORS.signupDisabled;
    if (msg.includes('provider') && (msg.includes('disabl') || msg.includes('not enabled'))) return FRIENDLY_ERRORS.providerDisabled;
    if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_email_send_rate_limit') || msg.includes('hit the maximum')) {
        return FRIENDLY_ERRORS.rateLimit;
    }
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('load failed')) {
        return FRIENDLY_ERRORS.network;
    }
    return FRIENDLY_ERRORS.generic;
}

function googleReturnError(err) {
    const e = (err || '').toLowerCase();
    if (e.includes('access_denied')) return 'Google sign-in was cancelled. Please try again.';
    if (e.includes('redirect_uri') || e.includes('invalid_request') || e.includes('unauthorized')) {
        return 'Google sign-in could not be completed. Please try email sign-in instead.';
    }
    return 'Google sign-in failed. Please try again.';
}

let modal = null;
let els = {};
let initialized = false;
let signingIn = false;
let activeMode = 'signin';
let previousOverflow = '';
let lastFocused = null;
let callbacks = { onSuccess: null, onNotice: null };

// Demo mode (Supabase frozen): auth runs on the localStorage emulator.
function isLocalMode() {
    try { return !!(window.LocalBackend && window.LocalBackend.useLocal()); }
    catch (_) { return false; }
}

// One-time demo hint so visitors know the demo accounts.
function ensureDemoHint() {
    if (!isLocalMode() || !modal) return;
    if (modal.querySelector('[data-demo-hint]')) return;
    const anchor = modal.querySelector('.auth-terms');
    const hint = document.createElement('p');
    hint.setAttribute('data-demo-hint', 'true');
    hint.style.cssText = 'margin:0.6rem 0 0;font-size:0.78rem;color:var(--text-secondary);text-align:center;line-height:1.5;';
    hint.innerHTML = 'Demo mode — no real accounts needed.<br>Shopper: <b>demo@eshop.demo</b> / <b>demo123</b> · Admin: <b>admin@eshop.demo</b> / <b>Demo123!</b><br>Google button signs you in instantly. Forgot password resets to <b>demo1234</b>.';
    if (anchor) anchor.before(hint);
    else modal.querySelector('.auth-dialog')?.appendChild(hint);
}

// ─── ELEMENT HELPERS ───────────────────────────────────────
function cacheElements() {
    const gid = (id) => document.getElementById(id);
    els.modal = modal;
    els.dialog = modal.querySelector('.auth-dialog');
    els.close = gid('authModalClose');
    els.title = gid('authTitle');
    els.subtitle = gid('authSubtitle');
    els.dividerText = gid('authDividerText');
    els.googleBtn = gid('authGoogleBtn');
    els.form = gid('authForm');
    els.nameField = gid('authNameField');
    els.nameInput = gid('authName');
    els.emailInput = gid('authEmail');
    els.passwordInput = gid('authPassword');
    els.eyeBtn = gid('authEyeBtn');
    els.forgotBtn = gid('authForgotBtn');
    els.submitBtn = gid('authSubmitBtn');
    els.submitLabel = gid('authSubmitLabel');
    els.switchText = gid('authSwitchText');
    els.switchBtn = gid('authSwitchBtn');
    els.formError = gid('authFormError');
    els.formErrorText = gid('authFormErrorText');
}

// ─── TEXT / MODE ───────────────────────────────────────────
function renderText() {
    const isSignup = activeMode === 'signup';
    els.title.textContent = isSignup ? 'Create your account' : 'Welcome back';
    els.subtitle.textContent = isSignup
        ? 'Sign up to save your details and track your orders.'
        : 'Sign in to continue to checkout.';
    els.dividerText.textContent = isSignup ? 'or sign up with email' : 'or continue with email';
    if (els.nameField) els.nameField.hidden = !isSignup;
    els.passwordInput.setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
    els.passwordInput.placeholder = isSignup ? 'Create a password' : 'Enter your password';
    els.submitLabel.textContent = isSignup ? 'Sign Up' : 'Sign In';
    els.switchText.textContent = isSignup ? 'Already have an account?' : "Don't have an account?";
    els.switchBtn.textContent = isSignup ? 'Sign in' : 'Sign up';
    if (els.forgotBtn) els.forgotBtn.style.visibility = isSignup ? 'hidden' : 'visible';
}

function switchMode() {
    activeMode = activeMode === 'signup' ? 'signin' : 'signup';
    renderText();
    els.passwordInput.type = 'password';
    els.eyeBtn.classList.remove('showing');
    els.eyeBtn.setAttribute('aria-pressed', 'false');
    els.eyeBtn.setAttribute('aria-label', 'Show password');
    clearAllErrors();
    (activeMode === 'signup' ? els.nameInput : els.emailInput).focus();
}

function togglePassword() {
    const showing = els.passwordInput.type === 'text';
    els.passwordInput.type = showing ? 'password' : 'text';
    els.eyeBtn.classList.toggle('showing', !showing);
    els.eyeBtn.setAttribute('aria-pressed', String(!showing));
    els.eyeBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    els.passwordInput.focus();
}

// ─── VALIDATION / ERRORS ───────────────────────────────────
function validateEmail(email) {
    if (!email) return 'Please enter your email address.';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Please enter a valid email address.';
}

function showFormError(message) {
    if (!els.formError) return;
    els.formErrorText.textContent = message || '';
    els.formError.hidden = false;
}

function hideFormError() {
    if (!els.formError) return;
    els.formError.hidden = true;
    els.formErrorText.textContent = '';
}

function showFieldError(input, message) {
    const el = document.getElementById((input.id || '') + 'Error');
    if (el) {
        el.textContent = message;
        el.hidden = false;
    }
    input.setAttribute('aria-invalid', 'true');
}

function clearFieldErrors() {
    ['authName', 'authEmail', 'authPassword'].forEach((id) => {
        const input = document.getElementById(id);
        const el = document.getElementById(id + 'Error');
        if (input) input.removeAttribute('aria-invalid');
        if (el) {
            el.textContent = '';
            el.hidden = true;
        }
    });
}

function clearField(id) {
    const input = document.getElementById(id);
    if (input) input.removeAttribute('aria-invalid');
    const el = document.getElementById(id + 'Error');
    if (el) {
        el.textContent = '';
        el.hidden = true;
    }
}

function clearAllErrors() {
    clearFieldErrors();
    hideFormError();
}

// ─── RETURN INTENT (OAuth continuation) ────────────────────
function saveReturnIntent() {
    try {
        sessionStorage.setItem(RETURN_KEY, window.location.href);
    } catch { /* noop */ }
}

function clearReturnIntent() {
    try {
        sessionStorage.removeItem(RETURN_KEY);
    } catch { /* noop */ }
}

// ─── OAuth error detection after redirect ──────────────────
function readOAuthError() {
    let params = null;
    try {
        const raw = window.location.hash || '';
        if (raw) params = new URLSearchParams(raw.replace(/^#/, '?'));
    } catch { params = null; }
    if (!params) {
        try { params = new URLSearchParams(window.location.search); } catch { params = null; }
    }
    if (!params) return '';
    const err = params.get('error') || params.get('error_description') || params.get('error_code');
    if (!err) return '';
    try {
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, document.title || '', window.location.pathname + window.location.search);
        }
    } catch { /* noop */ }
    return googleReturnError(err);
}

// ─── BUSY / LOADING STATES ─────────────────────────────────
function setEmailBusy(on) {
    signingIn = !!on;
    els.submitBtn.disabled = on;
    els.googleBtn.disabled = on;
    els.submitBtn.classList.toggle('loading', on);
    if (on) {
        els.submitLabel.textContent = activeMode === 'signup' ? 'Creating account...' : 'Signing in...';
    } else {
        renderText();
    }
    els.submitBtn.setAttribute('aria-busy', String(on));
}

function setGoogleBusy(on) {
    signingIn = !!on;
    els.googleBtn.disabled = on;
    els.submitBtn.disabled = on;
    els.googleBtn.classList.toggle('loading', !!on);
    els.googleBtn.setAttribute('aria-busy', String(on));
}

// ─── ACTIONS ───────────────────────────────────────────────
function emitSuccess() {
    closeAuthModal();
    if (callbacks.onSuccess) callbacks.onSuccess();
}

function emitNotice(message) {
    if (callbacks.onNotice) callbacks.onNotice(message);
}

async function handleSubmit(event) {
    event.preventDefault();
    if (signingIn) return;

    const email = els.emailInput.value.trim();
    const password = els.passwordInput.value;
    hideFormError();
    clearFieldErrors();

    let firstBad = null;
    const bad = (input, msg) => {
        showFieldError(input, msg);
        if (!firstBad) firstBad = input;
    };

    if (activeMode === 'signup') {
        if (!els.nameInput.value.trim()) bad(els.nameInput, 'Please enter your full name.');
        if (password.length < 6) bad(els.passwordInput, 'Password must be at least 6 characters long.');
    } else if (!password) {
        bad(els.passwordInput, 'Please enter your password.');
    }

    const emailErr = validateEmail(email);
    if (emailErr) bad(els.emailInput, emailErr);

    if (firstBad) {
        firstBad.focus();
        return;
    }

    const supabase = createClient();
    if (!supabase) {
        showFormError('Authentication is temporarily unavailable. Please try again.');
        return;
    }

    setEmailBusy(true);
    try {
        if (activeMode === 'signup') {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: els.nameInput.value.trim() } }
            });
            if (error) throw error;
            if (data && data.session) {
                emitSuccess();
            } else {
                setEmailBusy(false);
                emitNotice('Account created! Please check your email to confirm your account.');
                closeAuthModal();
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            emitSuccess();
        }
    } catch (err) {
        setEmailBusy(false);
        showFormError(friendlyError(err));
    }
}

async function handleGoogle() {
    if (signingIn) return;
    clearAllErrors();
    const supabase = createClient();
    if (!supabase) {
        showFormError('Authentication is temporarily unavailable. Please try again.');
        return;
    }
    saveReturnIntent();
    setGoogleBusy(true);
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
        if (error) throw error;
        // Local demo mode: no redirect — the emulator signs in a demo
        // Google shopper instantly. (Live Supabase redirects away, so
        // the lines below never run there.)
        if (data && data.session) {
            setGoogleBusy(false);
            emitSuccess();
        }
    } catch (err) {
        setGoogleBusy(false);
        showFormError(friendlyError(err));
    }
}

async function handleForgot() {
    if (signingIn) return;
    clearAllErrors();
    const email = els.emailInput.value.trim();
    if (!email) {
        showFieldError(els.emailInput, 'Please enter your email address to reset your password.');
        els.emailInput.focus();
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFieldError(els.emailInput, 'Please enter a valid email address.');
        els.emailInput.focus();
        return;
    }

    const supabase = createClient();
    if (!supabase) {
        showFormError('Authentication is temporarily unavailable. Please try again.');
        return;
    }

    els.submitBtn.disabled = true;
    els.googleBtn.disabled = true;
    signingIn = true;
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        signingIn = false;
        els.submitBtn.disabled = false;
        els.googleBtn.disabled = false;
        emitNotice(isLocalMode()
            ? 'Demo mode: your password was reset to demo1234. Sign in with it.'
            : 'Password reset link sent to your email.');
        closeAuthModal();
    } catch (err) {
        signingIn = false;
        els.submitBtn.disabled = false;
        els.googleBtn.disabled = false;
        showFormError(friendlyError(err));
    }
}

// ─── PUBLIC API ────────────────────────────────────────────
export function initAuthModal() {
    if (initialized) return;
    modal = document.getElementById('authModal');
    if (!modal) return;
    initialized = true;
    cacheElements();

    els.close.addEventListener('click', () => closeAuthModal());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAuthModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isAuthModalOpen()) closeAuthModal();
    });

    els.form.addEventListener('submit', handleSubmit);
    els.googleBtn.addEventListener('click', handleGoogle);
    els.eyeBtn.addEventListener('click', togglePassword);
    els.switchBtn.addEventListener('click', switchMode);
    els.forgotBtn.addEventListener('click', handleForgot);

    els.nameInput.addEventListener('input', () => clearField('authName'));
    els.emailInput.addEventListener('input', () => clearField('authEmail'));
    els.passwordInput.addEventListener('input', () => clearField('authPassword'));

    if (els.dialog) {
        els.dialog.querySelectorAll('a[href="#"]').forEach((a) =>
            a.addEventListener('click', (e) => e.preventDefault())
        );
    }
}

export function openAuthModal(options = {}) {
    initAuthModal();
    if (!modal) return;

    activeMode = options.mode === 'signup' ? 'signup' : 'signin';
    callbacks.onSuccess = typeof options.onSuccess === 'function' ? options.onSuccess : null;
    callbacks.onNotice = typeof options.onNotice === 'function' ? options.onNotice : null;

    signingIn = false;
    els.submitBtn.disabled = false;
    els.googleBtn.disabled = false;
    els.submitBtn.classList.remove('loading');
    els.googleBtn.classList.remove('loading');

    renderText();
    clearAllErrors();
    ensureDemoHint();
    if (options.notice) showFormError(options.notice);
    if (options.email) els.emailInput.value = options.email;

    modal.classList.add('open');
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    lastFocused = document.activeElement;

    const target = activeMode === 'signup' ? els.nameInput : els.emailInput;
    setTimeout(() => target.focus(), 80);
}

export function closeAuthModal() {
    if (!modal || !isAuthModalOpen()) return;
    modal.classList.remove('open');
    clearReturnIntent();
    document.body.style.overflow = previousOverflow || '';
    if (lastFocused && typeof lastFocused.focus === 'function' && lastFocused.isConnected) {
        try { lastFocused.focus(); } catch { /* noop */ }
    }
}

export function isAuthModalOpen() {
    return !!(modal && modal.classList.contains('open'));
}

export function checkOAuthErrorAndShow() {
    if (!initialized) initAuthModal();
    const message = readOAuthError();
    if (!message) return;
    openAuthModal({ mode: 'signin', notice: message });
}

export default { initAuthModal, openAuthModal, closeAuthModal, isAuthModalOpen, checkOAuthErrorAndShow };