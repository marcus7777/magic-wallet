const fs = require('fs');
const path = require('path');

describe('Feature 7: Offline First & PWA Ready (Manifest and SW)', () => {
  test('manifest.json contains valid Web App Manifest properties', () => {
    const manifestPath = path.join(__dirname, '../../magic-wallet/manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const raw = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');
    const content = JSON.parse(raw);
    expect(content.name).toBe('Magic Wallet');
    expect(content.short_name).toBe('Wallet');
    expect(content.start_url).toBe('.');
    expect(content.display).toBe('standalone');
    expect(content.icons).toBeDefined();
    expect(content.icons.length).toBeGreaterThan(0);
  });

  test('sw.js exists and registers static cache assets', () => {
    const swPath = path.join(__dirname, '../../magic-wallet/sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swCode = fs.readFileSync(swPath, 'utf8');
    expect(swCode).toContain('CACHE_NAME');
    expect(swCode).toContain('install');
    expect(swCode).toContain('fetch');
    expect(swCode).toContain('index.html');
  });
});
