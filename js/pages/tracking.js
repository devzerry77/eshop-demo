// ─── TRACKING ───────────────────────────────────────────
import { STORAGE_KEYS } from '../core/config.js';

let userIP = localStorage.getItem(STORAGE_KEYS.userIP) || 'Unknown';
let userLocation = (() => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.userLocation)) ||
            { country: 'N/A', countryCode: '', region: '', city: '' };
    } catch {
        return { country: 'N/A', countryCode: '', region: '', city: '' };
    }
})();

let geoPromise = null;
const GEO_TIMEOUT = 4000;

function isRealIP(ip) {
    return !!(ip && ip !== 'Unknown' && !/^anon-/i.test(ip) && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip));
}

function persistGeo() {
    try {
        localStorage.setItem(STORAGE_KEYS.userIP, userIP);
        localStorage.setItem(STORAGE_KEYS.userLocation, JSON.stringify(userLocation));
    } catch { /* noop */ }
}

// Resolve IP -> { country, countryCode, region, city } or null.
// Production (https) uses ipapi.co (HTTPS + CORS). When the page is served over
// plain http (local dev), prefer ip-api.com which does not support SSL.
async function resolveLocation(ip) {
    if (window.location.protocol === 'http:') {
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,city`);
        const data = await res.json();
        if (data && data.status === 'success') {
            return {
                country: data.country || 'N/A',
                countryCode: data.countryCode || '',
                region: data.region || '',
                city: data.city || ''
            };
        }
        return null;
    }
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await res.json();
    if (!data || data.error) return null;
    return {
        country: data.country_name || 'N/A',
        countryCode: data.country_code || '',
        region: data.region || '',
        city: data.city || ''
    };
}

async function fetchGeoInternal() {
    try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        if (!ipRes.ok) throw new Error('ipify failed');
        const ipData = await ipRes.json();
        if (ipData && ipData.ip) userIP = ipData.ip;

        if (isRealIP(userIP)) {
            const loc = await resolveLocation(userIP);
            if (loc) userLocation = loc;
        }
    } catch (e) {
        console.warn('IP/location fetch failed:', e);
        if (!isRealIP(userIP)) {
            userIP = 'anon-' + Math.random().toString(36).substring(2, 7);
        }
    }
    persistGeo();
}

export function getUserInfo() {
    return { ip: userIP, location: userLocation };
}

// Kick off IP + location resolution once. Callers may await it.
export function fetchIPAndLocation() {
    if (!geoPromise) {
        geoPromise = fetchGeoInternal().catch((e) => {
            console.warn('Geo resolution failed:', e);
        });
    }
    return geoPromise;
}

// Wait for the in-flight geo lookup (with a timeout) so logged activity
// includes the resolved IP + location instead of the initial defaults.
function waitForGeo() {
    if (!geoPromise) return Promise.resolve();
    let settled = false;
    return new Promise((resolve) => {
        const timer = setTimeout(() => { if (!settled) { settled = true; resolve(); } }, GEO_TIMEOUT);
        geoPromise.then(() => {
            if (!settled) { settled = true; clearTimeout(timer); resolve(); }
        });
    });
}

export async function logCartActivity(productId, productTitle) {
    await waitForGeo();
    try {
        const activities = JSON.parse(localStorage.getItem(STORAGE_KEYS.cartActivity) || '[]');
        activities.push({
            ip: userIP,
            productId,
            productTitle,
            timestamp: new Date().toISOString(),
            location: userLocation
        });
        localStorage.setItem(STORAGE_KEYS.cartActivity, JSON.stringify(activities));
    } catch { /* noop */ }
}

export function trackVisitor() {
    let visits = parseInt(localStorage.getItem(STORAGE_KEYS.visits) || '0');
    visits++;
    localStorage.setItem(STORAGE_KEYS.visits, visits);
    let live = parseInt(localStorage.getItem(STORAGE_KEYS.live) || '0');
    live++;
    localStorage.setItem(STORAGE_KEYS.live, live);
    setTimeout(() => {
        let currentLive = parseInt(localStorage.getItem(STORAGE_KEYS.live) || '0');
        if (currentLive > 0) {
            currentLive--;
            localStorage.setItem(STORAGE_KEYS.live, currentLive);
        }
    }, 30000);
}

export function trackCartAdd() {
    let total = parseInt(localStorage.getItem(STORAGE_KEYS.totalCartAdds) || '0');
    total++;
    localStorage.setItem(STORAGE_KEYS.totalCartAdds, total);
}