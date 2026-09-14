// ─── DESKTOP ACCOUNT LINK (session-aware) ─────────────────
// Upgrades header Account icon buttons so signed-in users land
// on profile.html and signed-out visitors on login.html.
// Falls back silently to the default href (login.html) on error.
(async function () {
    const links = document.querySelectorAll('[data-account-link]');
    if (!links.length) return;
    try {
        if (window.location.pathname.includes('/admin')) return;
        const { createClient } = await import('../supabase/client.js');
        const supabase = createClient();
        if (!supabase) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) links.forEach((a) => { a.href = 'profile.html'; });
    } catch (e) { /* keep login.html default */ }
})();