/**
 * @jest-environment jsdom
 */

const { setupEnvironment } = require('./setup');

describe('Feature 2: QR Code & 1D Barcode Rendering', () => {
  beforeEach(() => {
    localStorage.clear();
    setupEnvironment();
  });

  test('getCardFormat auto-detects 8-18 digit numeric strings as barcode and others as QR', () => {
    expect(window.CardStore.add({ name: 'Numeric', data: '9876543210123' }).format).toBe('barcode');
    expect(window.CardStore.add({ name: 'Short Numeric', data: '12345678' }).format).toBe('barcode');
    expect(window.CardStore.add({ name: 'Text Data', data: 'DISCOUNT-2026' }).format).toBe('qr');
    expect(window.CardStore.add({ name: 'URL Data', data: 'https://example.com' }).format).toBe('qr');
  });

  test('Barcode.render generates 1D Code128 vector SVG barcode inside container', () => {
    const container = document.createElement('div');
    window.Barcode.render(container, '9876543210123');

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThan(5); // barcode bars
    const text = container.querySelector('text');
    expect(text.textContent).toBe('9876543210123');
  });

  test('QR.render generates SVG QR code inside container', () => {
    const container = document.createElement('div');
    window.QR.render(container, 'https://magicwallet.app');

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('viewBox')).toBeDefined();
  });

  test('Barcode.render handles invalid or empty inputs gracefully without throwing', () => {
    const container = document.createElement('div');
    expect(() => window.Barcode.render(container, '')).not.toThrow();
    expect(container.innerHTML).toBe('');

    expect(() => window.Barcode.render(container, null)).not.toThrow();
  });
});
