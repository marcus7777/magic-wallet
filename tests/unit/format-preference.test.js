/**
 * @jest-environment jsdom
 */

const { setupEnvironment } = require('./setup');

describe('Card Format Preference (TDD)', () => {
  beforeEach(() => {
    localStorage.clear();
    setupEnvironment();
  });

  test('CardStore.add saves explicit format preference for a card', () => {
    // Numeric data normally auto-detects to 'barcode', but user explicitly selects 'qr'
    const qrCard = window.CardStore.add({
      name: 'Numeric QR Preference',
      data: '1234567890123',
      format: 'qr'
    });
    expect(qrCard.format).toBe('qr');

    // Text data normally auto-detects to 'qr', but user explicitly selects 'barcode'
    const barcodeCard = window.CardStore.add({
      name: 'Text Barcode Preference',
      data: 'TEXT-LOYALTY-CODE',
      format: 'barcode'
    });
    expect(barcodeCard.format).toBe('barcode');
  });

  test('add-form includes format preference radio buttons (#card-format-qr and #card-format-barcode)', () => {
    const qrRadio = document.getElementById('card-format-qr');
    const barcodeRadio = document.getElementById('card-format-barcode');

    expect(qrRadio).not.toBeNull();
    expect(barcodeRadio).not.toBeNull();
    expect(qrRadio.value).toBe('qr');
    expect(barcodeRadio.value).toBe('barcode');
  });

  test('submitting add-form saves card with selected format preference', () => {
    window.App.init();
    document.getElementById('card-name').value = 'Format Choice Shop';
    document.getElementById('card-data').value = 'CODE-999';

    const barcodeRadio = document.getElementById('card-format-barcode');
    if (barcodeRadio) barcodeRadio.checked = true;

    const form = document.getElementById('add-form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    const cards = window.CardStore.getAll();
    expect(cards).toHaveLength(1);
    expect(cards[0].format).toBe('barcode');
  });

  test('openCard sets display format to saved card format preference', () => {
    const card = window.CardStore.add({
      name: 'Saved Format Store',
      data: '112233445566',
      format: 'qr' // numeric data forced to QR
    });

    window.App.init();
    // Simulate opening card detail screen
    const tile = document.querySelector(`[data-id="${card.id}"]`);
    if (tile) tile.click();

    const detailWrap = document.getElementById('detail-qr');
    expect(detailWrap.className).toContain('format-qr');
  });

  test('openEditCard populates format preference radio button', () => {
    const card = window.CardStore.add({
      name: 'Edit Format Store',
      data: '998877665544',
      format: 'barcode'
    });

    window.App.init();
    // Trigger edit card
    const editBtn = document.getElementById('detail-edit-top');
    // Open card first
    const tile = document.querySelector(`[data-id="${card.id}"]`);
    if (tile) tile.click();
    if (editBtn) editBtn.click();

    const barcodeRadio = document.getElementById('card-format-barcode');
    expect(barcodeRadio.checked).toBe(true);
  });

  test('toggling code format on detail screen updates and persists format preference in CardStore', () => {
    const card = window.CardStore.add({
      name: 'Toggle Persist Store',
      data: 'TOGGLE-123',
      format: 'qr'
    });

    window.App.init();
    const tile = document.querySelector(`[data-id="${card.id}"]`);
    if (tile) tile.click();

    // Toggle format
    const toggleBtn = document.getElementById('toggle-format-btn');
    if (toggleBtn) toggleBtn.click();

    const updated = window.CardStore.getById(card.id);
    expect(updated.format).toBe('barcode');
  });
});
