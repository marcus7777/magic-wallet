/**
 * @jest-environment jsdom
 */

const { setupEnvironment } = require('./setup');

describe('Feature 6 & Feature 8 & Feature 3: CardStore & LocalStorage Data Management', () => {
  beforeEach(() => {
    localStorage.clear();
    setupEnvironment();
  });

  test('CardStore.getAll returns empty array when localStorage has no cards', () => {
    expect(window.CardStore.getAll()).toEqual([]);
  });

  test('CardStore.add creates a new card with custom colors, emoji, and defaults', () => {
    const newCard = window.CardStore.add({
      name: 'Coffee Club',
      data: '1234567890123',
      emoji: '☕',
      color: '#22c55e'
    });

    expect(newCard.id).toBeDefined();
    expect(newCard.name).toBe('Coffee Club');
    expect(newCard.emoji).toBe('☕');
    expect(newCard.color).toBe('#22c55e');
    expect(newCard.format).toBe('barcode'); // auto-detected 13 digits

    const all = window.CardStore.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Coffee Club');
  });

  test('CardStore duplicates/merges location geohashes for identical cards', () => {
    const card1 = window.CardStore.add({
      name: 'Tesco',
      data: '11223344',
      color: '#6c63ff',
      locations: ['gcpvj0d']
    });

    const card2 = window.CardStore.add({
      name: 'Tesco',
      data: '11223344',
      color: '#6c63ff',
      locations: ['gcpvj0e']
    });

    expect(card2.isMerged).toBe(true);
    expect(card2.id).toBe(card1.id);
    expect(card2.locations).toEqual(['gcpvj0d', 'gcpvj0e']);

    const all = window.CardStore.getAll();
    expect(all).toHaveLength(1);
  });

  test('CardStore stores multiple codes per card separated by newlines or array', () => {
    const multiCard = window.CardStore.add({
      name: 'Family Membership',
      data: 'MEMBER-1001\nMEMBER-1002\nMEMBER-1003',
      emoji: '👨‍👩‍👧'
    });

    expect(multiCard.data).toEqual(['MEMBER-1001', 'MEMBER-1002', 'MEMBER-1003']);
    const stored = window.CardStore.getById(multiCard.id);
    expect(stored.data).toEqual(['MEMBER-1001', 'MEMBER-1002', 'MEMBER-1003']);
  });

  test('CardStore.update updates card properties and persists to localStorage', () => {
    const card = window.CardStore.add({ name: 'Old Store', data: '9999' });
    const updated = window.CardStore.update(card.id, {
      name: 'New Store Name',
      emoji: '🛍️',
      color: '#ef4444'
    });

    expect(updated.name).toBe('New Store Name');
    expect(updated.emoji).toBe('🛍️');
    expect(updated.color).toBe('#ef4444');

    const fresh = window.CardStore.getById(card.id);
    expect(fresh.name).toBe('New Store Name');
  });

  test('CardStore.updateFormat updates card format (qr <-> barcode)', () => {
    const card = window.CardStore.add({ name: 'Bookshop', data: 'https://example.com' });
    expect(card.format).toBe('qr');

    window.CardStore.updateFormat(card.id, 'barcode');
    expect(window.CardStore.getById(card.id).format).toBe('barcode');

    window.CardStore.updateFormat(card.id, 'qr');
    expect(window.CardStore.getById(card.id).format).toBe('qr');
  });

  test('CardStore.remove deletes card from localStorage by ID', () => {
    const c1 = window.CardStore.add({ name: 'Card 1', data: '100' });
    const c2 = window.CardStore.add({ name: 'Card 2', data: '200' });

    expect(window.CardStore.getAll()).toHaveLength(2);
    window.CardStore.remove(c1.id);

    const remaining = window.CardStore.getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(c2.id);
  });

  test('CardStore.addLocationGeohash caps location geohashes at maximum 20 items', () => {
    const card = window.CardStore.add({ name: 'Gym', data: 'GYM123' });
    for (let i = 0; i < 25; i++) {
      const gh = 'ghash0' + String(i % 10).padStart(2, '0');
      window.CardStore.addLocationGeohash(card.id, gh.padEnd(7, 'x'));
    }

    const updatedCard = window.CardStore.getById(card.id);
    expect(updatedCard.locations.length).toBeLessThanOrEqual(20);
  });

  test('CardStore.removeLocationGeohash removes specified location geohash from card', () => {
    const card = window.CardStore.add({
      name: 'Supermarket',
      data: 'LOC123',
      locations: ['gcpvj0d', 'gcpvj0e']
    });

    expect(card.locations).toEqual(['gcpvj0d', 'gcpvj0e']);

    window.CardStore.removeLocationGeohash(card.id, 'gcpvj0d');
    const updated = window.CardStore.getById(card.id);
    expect(updated.locations).toEqual(['gcpvj0e']);
  });

  test('Edit card screen renders saved locations and allows removing a location', () => {
    const card = window.CardStore.add({
      name: 'Local Store',
      data: 'STORE-999',
      locations: ['gcpvj0a', 'gcpvj0b']
    });

    window.App.init();

    const tile = document.querySelector(`[data-id="${card.id}"]`);
    expect(tile).not.toBeNull();
    tile.click();

    const editBtn = document.getElementById('detail-edit-top');
    expect(editBtn).not.toBeNull();
    editBtn.click();

    const editWrap = document.getElementById('edit-locations-wrap');
    expect(editWrap.classList.contains('hidden')).toBe(false);

    const removeBtns = editWrap.querySelectorAll('.btn-remove-loc');
    expect(removeBtns.length).toBe(2);

    removeBtns[0].click();

    const updated = window.CardStore.getById(card.id);
    expect(updated.locations).toEqual(['gcpvj0b']);
  });
});
