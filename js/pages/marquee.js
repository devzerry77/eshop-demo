// ─── MARQUEE LOADER ─────────────────────────────────────
import { createClient } from '../supabase/client.js';

export function applyMarqueeStyles(bar, span, text, speed, glowColor, glowIntensity, borderGlow, borderColor, bgColor, textColor) {
    if (!bar || !span) return;
    span.innerHTML = text;
    span.style.color = textColor;
    span.style.animation = `marqueeScroll ${speed}s linear infinite`;

    if (glowIntensity > 0) {
        span.style.textShadow = `0 0 ${glowIntensity}px ${glowColor}, 0 0 ${glowIntensity * 2}px ${glowColor}40`;
    } else {
        span.style.textShadow = 'none';
    }

    if (borderGlow) {
        bar.style.boxShadow = `0 0 20px ${borderColor}, inset 0 0 20px ${borderColor}20`;
        bar.style.border = `1px solid ${borderColor}40`;
    } else {
        bar.style.boxShadow = 'none';
        bar.style.border = 'none';
    }
    bar.style.background = bgColor;
}

export async function loadMarquee() {
    const bar = document.querySelector('.marquee-bar');
    const span = bar?.querySelector('span');
    if (!bar || !span) return;

    // Try localStorage first
    const text = localStorage.getItem('grabby_marquee_text');
    const enabled = localStorage.getItem('grabby_marquee_enabled');
    const glowColor = localStorage.getItem('grabby_marquee_glow_color') || '#ff6b6b';
    const glowIntensity = parseInt(localStorage.getItem('grabby_marquee_glow_intensity')) || 20;
    const borderGlow = localStorage.getItem('grabby_marquee_border_glow') !== 'false';
    const borderColor = localStorage.getItem('grabby_marquee_border_color') || '#667eea';
    const speed = parseInt(localStorage.getItem('grabby_marquee_speed')) || 20;
    const bgColor = localStorage.getItem('grabby_marquee_bg_color') || '#0a0a0a';
    const textColor = localStorage.getItem('grabby_marquee_text_color') || '#ffffff';

    if (enabled !== 'false' && text) {
        applyMarqueeStyles(bar, span, text, speed, glowColor, glowIntensity, borderGlow, borderColor, bgColor, textColor);
        bar.style.display = 'block';
    } else if (enabled === 'false') {
        bar.style.display = 'none';
    }

    // Always fetch from Supabase to get the latest (and update localStorage)
    try {
        const supabase = createClient();
        if (supabase) {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .in('key', [
                    'marquee_text', 'marquee_enabled', 'marquee_glow_color',
                    'marquee_glow_intensity', 'marquee_border_glow', 'marquee_border_color',
                    'marquee_speed', 'marquee_bg_color', 'marquee_text_color'
                ]);
            if (!error && data) {
                const settings = {};
                data.forEach(row => { settings[row.key] = row.value; });
                Object.keys(settings).forEach(key => {
                    localStorage.setItem('grabby_' + key, settings[key]);
                });
                if (settings.marquee_enabled !== 'false' && settings.marquee_text) {
                    applyMarqueeStyles(
                        bar, span,
                        settings.marquee_text,
                        parseInt(settings.marquee_speed) || 20,
                        settings.marquee_glow_color || '#ff6b6b',
                        parseInt(settings.marquee_glow_intensity) || 20,
                        settings.marquee_border_glow !== 'false',
                        settings.marquee_border_color || '#667eea',
                        settings.marquee_bg_color || '#0a0a0a',
                        settings.marquee_text_color || '#ffffff'
                    );
                    bar.style.display = 'block';
                } else if (settings.marquee_enabled === 'false') {
                    bar.style.display = 'none';
                }
            }
        }
    } catch (e) {
        console.warn('Failed to load marquee from Supabase:', e);
    }
}