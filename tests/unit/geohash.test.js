/**
 * @jest-environment jsdom
 */

const { setupEnvironment } = require('./setup');

describe('Feature 1: Location-Aware Card Matching (Geohash & Location)', () => {
  beforeEach(() => {
    localStorage.clear();
    setupEnvironment();
  });

  test('Geohash.encode encodes coordinates to 7-character base32 geohashes', () => {
    // London coordinates: ~51.5074, -0.1278
    const gh7 = window.Geohash.encode(51.5074, -0.1278, 7);
    expect(gh7).toHaveLength(7);
    expect(gh7).toBe('gcpvj0d');
  });

  test('Geohash.decode decodes geohash back to bounding box and center coordinate', () => {
    const decoded = window.Geohash.decode('gcpvj0d');
    expect(decoded.lat).toBeCloseTo(51.5074, 1);
    expect(decoded.lon).toBeCloseTo(-0.1278, 1);
    expect(decoded.latMin).toBeLessThan(decoded.latMax);
    expect(decoded.lonMin).toBeLessThan(decoded.lonMax);
  });

  test('Geohash.getNeighbors returns center plus 8 surrounding geohashes (9 unique hashes)', () => {
    const neighbors = window.Geohash.getNeighbors('gcpvj0d');
    expect(neighbors.length).toBeGreaterThanOrEqual(8);
    expect(neighbors).toContain('gcpvj0d');
  });

  test('Geohash.getNearbyGeohashes returns center and all 8 neighbor cells', () => {
    const nearby = window.Geohash.getNearbyGeohashes(51.5074, -0.1278, 7);
    expect(nearby.center).toBe('gcpvj0d');
    expect(nearby.all).toContain('gcpvj0d');
    expect(nearby.all.length).toBe(9);
  });

  test('Location.findNearest matches card on exact center geohash cell', () => {
    const centerGh = window.Geohash.encode(51.5074, -0.1278, 7);
    const mockCards = [
      { id: '1', name: 'Tesco London', locations: [centerGh] },
      { id: '2', name: 'Sainsbury Store', locations: ['ffffff1'] }
    ];

    const match = window.Location.findNearest(mockCards, 51.5074, -0.1278);
    expect(match).not.toBeNull();
    expect(match.matchType).toBe('exact');
    expect(match.card.name).toBe('Tesco London');
    expect(match.geohash).toBe(centerGh);
  });

  test('Location.findNearest matches card on 8 surrounding neighbor geohash cells (~150m grid)', () => {
    const centerGh = window.Geohash.encode(51.5074, -0.1278, 7);
    const neighbors = window.Geohash.getNeighbors(centerGh);
    const neighborGh = neighbors.find(gh => gh !== centerGh);

    const mockCards = [
      { id: '1', name: 'Sainsbury Nearby', locations: [neighborGh] }
    ];

    const match = window.Location.findNearest(mockCards, 51.5074, -0.1278);
    expect(match).not.toBeNull();
    expect(match.matchType).toBe('nearby');
    expect(match.card.name).toBe('Sainsbury Nearby');
    expect(match.geohash).toBe(neighborGh);
  });

  test('Location.findNearest returns null when user is far away from saved locations', () => {
    const mockCards = [
      { id: '1', name: 'Tokyo Shop', locations: ['xn76ur1'] }
    ];

    const match = window.Location.findNearest(mockCards, 51.5074, -0.1278);
    expect(match).toBeNull();
  });
});
