// ─── PRODUCT CARD ACTIONS (shared delegation for premium cards) ───
// One contract for home / collection / search / rails:
// - wishlist toggles sync EVERY heart with the same product id
// - add-to-cart button labels sync across ALL copies of the card
// - wishlist / quick-view clicks never bubble into card navigation
import { toggleWishlist, premiumToast } from './premium.js';

const ADD_SELECTORS = '.p-add-btn[data-action="add-cart"], .add-cart-btn[data-action="add-cart"]';

export function syncCardButtons(id, inCart, labelWhenOut = 'Add to Cart') {
  document.querySelectorAll(`${ADD_SELECTORS}[data-id="${CSS.escape(String(id))}"]`).forEach(btn => {
    if (btn.disabled) return;
    btn.textContent = inCart ? '✓ In Cart' : labelWhenOut;
  });
}

export function flashCardButton(id, text = '✓ Added!', revertTo = '✓ In Cart') {
  document.querySelectorAll(`${ADD_SELECTORS}[data-id="${CSS.escape(String(id))}"]`).forEach(btn => {
    if (btn.disabled) return;
    btn.textContent = text;
    setTimeout(() => {
      if (document.body.contains(btn)) btn.textContent = revertTo;
    }, 1000);
  });
}

export function syncWishlistButtons(id, active) {
  document.querySelectorAll(`[data-action="wishlist"][data-id="${CSS.escape(String(id))}"]`).forEach(btn => {
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

// options: { onAdd(id), onQuickView(id), onNavigate(id), scopeToast=true }
export function bindProductCards(root, options = {}) {
  if (!root || root.__cardsBound) return;
  root.__cardsBound = true;
  const { onAdd, onQuickView, onNavigate } = options;
  root.addEventListener('click', e => {
    const wishBtn = e.target.closest('[data-action="wishlist"]');
    if (wishBtn && root.contains(wishBtn)) {
      e.stopPropagation();
      e.preventDefault();
      const added = toggleWishlist(wishBtn.dataset.id);
      syncWishlistButtons(wishBtn.dataset.id, added);
      premiumToast(added ? 'Saved to wishlist ♥' : 'Removed from wishlist', added ? 'success' : 'info');
      return;
    }
    const cartBtn = e.target.closest('[data-action="add-cart"]');
    if (cartBtn && root.contains(cartBtn)) {
      e.stopPropagation();
      e.preventDefault();
      if (!cartBtn.disabled && onAdd) onAdd(cartBtn.dataset.id);
      return;
    }
    const viewBtn = e.target.closest('[data-action="quick-view"]');
    if (viewBtn && root.contains(viewBtn)) {
      e.stopPropagation();
      e.preventDefault();
      if (onQuickView) onQuickView(viewBtn.dataset.id);
      return;
    }
    const card = e.target.closest('.product-card');
    if (card && root.contains(card) && !e.target.closest('button, a')) {
      if (onNavigate) onNavigate(card.dataset.id);
    }
  });
}
