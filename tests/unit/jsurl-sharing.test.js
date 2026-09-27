/**
 * @jest-environment jsdom
 */

const { setupEnvironment } = require('./setup');

describe('Feature 5: Instant Sharing & URL Import', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.location;
    window.location = new URL('http://localhost:8080/');
    setupEnvironment();
  });

  test('JSURL stringifies and parses card objects accurately', () => {
    const cardData = {
      name: 'Supermarket Loyalty',
      data: '998877665544',
      emoji: '🛒',
      color: '#0ea5e9',
      format: 'barcode',
      locations: ['gcpvj0d']
    };

    const encoded = window.JSURL.stringify(cardData);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(10);

    const decoded = window.JSURL.parse(encoded);
    expect(decoded).toEqual(cardData);
  });

  test('checkUrlForCardImport automatically parses #card=... hash and imports card to wallet', () => {
    const cardData = {
      name: 'Shared Club Card',
      data: 'CLUB-12345',
      emoji: '🎁',
      color: '#ec4899',
      format: 'qr',
      locations: ['gcpvj0d']
    };

    const encoded = window.JSURL.stringify(cardData);
    window.location.hash = `#card=${encoded}`;

    // Re-trigger App initialization / import check
    window.App.init();

    const cards = window.CardStore.getAll();
    expect(cards).toHaveLength(1);
    expect(cards[0].name).toBe('Shared Club Card');
    expect(cards[0].data).toBe('CLUB-12345');
    expect(cards[0].emoji).toBe('🎁');
    expect(cards[0].locations).toEqual(['gcpvj0d']);
  });
});
