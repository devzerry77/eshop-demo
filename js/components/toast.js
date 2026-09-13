// ─── TOAST COMPONENT ────────────────────────────────────
export function showToast(containerId, message, duration = 2000) {
    const tc = document.getElementById(containerId);
    if (!tc) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    tc.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('out');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}