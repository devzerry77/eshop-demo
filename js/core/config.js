// ─── CONFIG ──────────────────────────────────────────────
export const STORAGE_KEYS = {
    cache: 'grabby_cache',
    products: 'grabby_products',
    cart: 'grabby_cart',
    wishlist: 'grabby_wishlist',
    theme: 'grabby_theme',
    currency: 'grabby_currency',
    visits: 'grabby_visits',
    live: 'grabby_live',
    totalCartAdds: 'grabby_total_cart_adds',
    userIP: 'grabby_user_ip',
    userLocation: 'grabby_user_location',
    cartActivity: 'grabby_cart_activity',
    coupon: 'grabby_coupon'
};

export const CACHE_KEY = STORAGE_KEYS.cache;
export const CACHE_EXPIRY = 5 * 60 * 1000;

export const CURRENCY = 'BDT';
export const SHIPPING_FREE_ABOVE = 2000;
export const SHIPPING_COST = 100;

export const DEFAULT_PRODUCTS = [
    { id: 1, title: 'High-Pressure Foam Spray', category: 'lifestyle', price: 1787, originalPrice: null, rating: 4.2, reviews: 23, description: 'Professional foam sprayer with adjustable nozzle and 2L capacity.', specs: { Capacity: '2L', Pressure: '3.5 bar' }, inStock: false, badge: 'Sold out', image: 'https://picsum.photos/seed/foam/400/400', images: ['https://picsum.photos/seed/foam/400/400'], details: {} },
    { id: 2, title: 'Portable Hookah Go', category: 'lifestyle', price: 3997, originalPrice: null, rating: 4.4, reviews: 45, description: 'Compact travel hookah with premium glass construction.', specs: { Height: '25cm', Material: 'Glass' }, inStock: true, badge: null, image: 'https://picsum.photos/seed/hookah/400/400', images: ['https://picsum.photos/seed/hookah/400/400'], details: {} },
    { id: 3, title: 'Magnetic Accessory Disc', category: 'accessories', price: 450, originalPrice: null, rating: 3.8, reviews: 12, description: 'Universal magnetic mount with N52 neodymium magnets.', specs: { Diameter: '48mm', Magnet: 'N52' }, inStock: false, badge: 'Sold out', image: 'https://picsum.photos/seed/magnet/400/400', images: ['https://picsum.photos/seed/magnet/400/400'], details: {} },
    { id: 4, title: 'Wireless Charging Hub', category: 'electronics', price: 2450, originalPrice: 3200, rating: 4.9, reviews: 67, description: '3-in-1 wireless charger for phone, watch, and earbuds.', specs: { Output: '15W', Coils: '3' }, inStock: true, badge: 'Sale', image: 'https://picsum.photos/seed/charger/400/400', images: ['https://picsum.photos/seed/charger/400/400'], details: {} },
    { id: 5, title: 'Noise Cancelling Buds', category: 'audio', price: 1250, originalPrice: null, rating: 4.6, reviews: 89, description: 'ANC earbuds with 6h battery and crystal clear sound.', specs: { Battery: '6h', Driver: '10mm' }, inStock: true, badge: null, image: 'https://picsum.photos/seed/buds/400/400', images: ['https://picsum.photos/seed/buds/400/400'], details: {} },
    { id: 6, title: 'USB-C Multi Hub', category: 'accessories', price: 890, originalPrice: null, rating: 4.3, reviews: 34, description: '7-in-1 USB-C hub with HDMI 4K and SD card reader.', specs: { Ports: '7', HDMI: '4K' }, inStock: false, badge: 'Sold out', image: 'https://picsum.photos/seed/hub/400/400', images: ['https://picsum.photos/seed/hub/400/400'], details: {} },
    { id: 7, title: 'Smart Watch Pro', category: 'wearables', price: 4999, originalPrice: 5999, rating: 4.8, reviews: 120, description: 'AMOLED smartwatch with 7-day battery and health tracking.', specs: { Display: '1.43"', Battery: '7 days' }, inStock: true, badge: 'Sale', image: 'https://picsum.photos/seed/watch/400/400', images: ['https://picsum.photos/seed/watch/400/400'], details: {} },
    { id: 8, title: 'Gaming Mouse X', category: 'gaming', price: 4599, originalPrice: null, rating: 4.5, reviews: 56, description: 'Ultralight gaming mouse with PAW3395 sensor.', specs: { Sensor: 'PAW3395', Weight: '58g' }, inStock: true, badge: null, image: 'https://picsum.photos/seed/mouse/400/400', images: ['https://picsum.photos/seed/mouse/400/400'], details: {} },
    { id: 9, title: 'Mechanical Keyboard', category: 'gaming', price: 8999, originalPrice: 10999, rating: 4.9, reviews: 78, description: 'Hot-swappable TKL keyboard with Gateron Yellow switches.', specs: { Switches: 'Gateron Yellow', Layout: 'TKL' }, inStock: true, badge: 'Sale', image: 'https://picsum.photos/seed/keyboard/400/400', images: ['https://picsum.photos/seed/keyboard/400/400'], details: {} },
    { id: 10, title: '4K Action Camera', category: 'camera', price: 19999, originalPrice: null, rating: 4.7, reviews: 43, description: '4K60 action camera with EIS 2.0 stabilization.', specs: { Video: '4K60fps', Stabilization: 'EIS 2.0' }, inStock: true, badge: null, image: 'https://picsum.photos/seed/camera/400/400', images: ['https://picsum.photos/seed/camera/400/400'], details: {} },
    { id: 11, title: 'Bluetooth Speaker', category: 'audio', price: 6999, originalPrice: 8999, rating: 4.4, reviews: 92, description: 'Portable 360° speaker with 20h battery and 30W output.', specs: { Battery: '20h', Output: '30W' }, inStock: true, badge: 'Sale', image: 'https://picsum.photos/seed/speaker/400/400', images: ['https://picsum.photos/seed/speaker/400/400'], details: {} },
    { id: 12, title: 'Solar Power Bank', category: 'accessories', price: 3999, originalPrice: null, rating: 4.2, reviews: 38, description: '20000mAh solar power bank with 2W solar panel.', specs: { Capacity: '20000mAh', Solar: '2W' }, inStock: true, badge: null, image: 'https://picsum.photos/seed/solar/400/400', images: ['https://picsum.photos/seed/solar/400/400'], details: {} }
];

export const DEFAULT_PLACEHOLDER_IMAGE = 'https://picsum.photos/seed/default/400/400';