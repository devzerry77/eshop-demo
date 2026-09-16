// ─── IMGBB KEY (E-Shop Demo) ─────────────────────────────
// The image-upload key is deliberately NOT hardcoded in the repo.
// Resolution order:
//   1. window.ESHOP_IMGBB_KEY (set by js/supabase/imgbb.local.js, git-ignored)
//   2. localStorage 'eshop_imgbb_key' (saved via Admin → Settings)
//   3. '' (uploads disabled with a friendly message)
export function getImgBBKey() {
    try {
        if (typeof window !== 'undefined' && window.ESHOP_IMGBB_KEY) {
            return String(window.ESHOP_IMGBB_KEY);
        }
    } catch (_) { /* noop */ }
    try {
        return localStorage.getItem('eshop_imgbb_key') || '';
    } catch (_) {
        return '';
    }
}

export function setImgBBKey(key) {
    try {
        localStorage.setItem('eshop_imgbb_key', String(key || '').trim());
    } catch (_) { /* noop */ }
}

export async function uploadToImgBB(file) {
    const key = getImgBBKey();
    if (!key) {
        throw new Error('Image upload key is not configured. Set it in Admin → Settings → Image Uploads.');
    }
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(key), {
        method: 'POST',
        body: formData
    });
    if (!response.ok) {
        throw new Error('ImgBB upload failed: ' + response.status);
    }
    const data = await response.json();
    if (!data.success) {
        throw new Error('ImgBB error: ' + ((data.error && data.error.message) || 'Unknown error'));
    }
    return data.data.url;
}
