/**
 * @jest-environment node
 */

const path = require('path');
const { By, Key, until } = require('selenium-webdriver');
const { createStaticServer } = require('./server');
const { createDriver } = require('./driver-setup');

describe('Magic Wallet — Selenium E2E Test Suite for README Features', () => {
  let serverInfo;
  let driver;
  const staticPath = path.join(__dirname, '../../magic-wallet');

  async function safeClick(element) {
    await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', element);
    await driver.sleep(100);
    try {
      await element.click();
    } catch (_) {
      await driver.executeScript('arguments[0].click();', element);
    }
  }

  beforeAll(async () => {
    serverInfo = await createStaticServer(staticPath, 8088);
    driver = await createDriver();
  }, 30000);

  afterAll(async () => {
    if (driver) {
      await driver.quit();
    }
    if (serverInfo && serverInfo.server) {
      await new Promise(resolve => serverInfo.server.close(resolve));
    }
  });

  beforeEach(async () => {
    await driver.get(serverInfo.url);
    await driver.executeScript('localStorage.clear();');
    await driver.navigate().refresh();
  });

  test('Feature 8: Customizable Cards (Custom Emoji, Name & Color Swatch)', async () => {
    const addBtn = await driver.findElement(By.id('add-btn'));
    await safeClick(addBtn);

    await driver.wait(until.elementLocated(By.id('screen-add')), 5000);

    const emojiInput = await driver.findElement(By.id('card-emoji'));
    await emojiInput.clear();
    await emojiInput.sendKeys('☕');

    const nameInput = await driver.findElement(By.id('card-name'));
    await nameInput.sendKeys('Starbucks Club');

    const dataInput = await driver.findElement(By.id('card-data'));
    await dataInput.sendKeys('STB-123456789');

    const greenSwatch = await driver.findElement(By.css('.swatch[data-color="#22c55e"]'));
    await safeClick(greenSwatch);

    const submitBtn = await driver.findElement(By.id('add-submit-btn'));
    await safeClick(submitBtn);

    const cardTile = await driver.wait(until.elementLocated(By.css('.card-tile')), 5000);
    const tileText = await cardTile.getText();
    expect(tileText).toContain('☕');
    expect(tileText).toContain('Starbucks Club');

    const styleAttr = await cardTile.getAttribute('style');
    expect(styleAttr).toContain('--card-color: #22c55e');
  });

  test('Feature 2: QR Code & 1D Barcode Rendering and Toggle', async () => {
    await driver.executeScript(`
      CardStore.add({
        name: 'Supermarket Barcode',
        data: '9876543210123',
        emoji: '🛒',
        color: '#0ea5e9'
      });
    `);
    await driver.navigate().refresh();

    const tile = await driver.wait(until.elementLocated(By.css('.card-tile')), 5000);
    await safeClick(tile);

    await driver.wait(until.elementLocated(By.id('screen-detail')), 5000);

    const qrWrap = await driver.findElement(By.id('detail-qr'));
    let wrapClass = await qrWrap.getAttribute('class');
    expect(wrapClass).toContain('format-barcode');

    let rects = await qrWrap.findElements(By.css('rect'));
    expect(rects.length).toBeGreaterThan(5);

    const formatBtn = await driver.findElement(By.id('toggle-format-btn'));
    await safeClick(formatBtn);

    wrapClass = await qrWrap.getAttribute('class');
    expect(wrapClass).toContain('format-qr');

    let svgEl = await qrWrap.findElement(By.css('svg'));
    expect(svgEl).toBeDefined();

    await driver.navigate().refresh();
    const reopenedTile = await driver.wait(until.elementLocated(By.css('.card-tile')), 5000);
    await safeClick(reopenedTile);

    const reWrap = await driver.wait(until.elementLocated(By.id('detail-qr')), 5000);
    expect(await reWrap.getAttribute('class')).toContain('format-qr');
  });

  test('Feature 3: Multiple Codes per Card (Multi-code Storage & Shuffling)', async () => {
    await driver.executeScript(`
      CardStore.add({
        name: 'Family Pass',
        data: ['CODE-1001', 'CODE-1002', 'CODE-1003'],
        emoji: '👨‍👩‍👧',
        color: '#6c63ff'
      });
    `);
    await driver.navigate().refresh();

    const tile = await driver.wait(until.elementLocated(By.css('.card-tile')), 5000);
    await safeClick(tile);

    const badge = await driver.wait(until.elementLocated(By.id('detail-multi-badge')), 5000);
    const badgeText = await driver.executeScript('return arguments[0].textContent;', badge);
    expect(badgeText).toContain('of 3');

    const shuffleBtn = await driver.findElement(By.id('shuffle-code-btn'));
    expect(await shuffleBtn.isDisplayed()).toBe(true);

    const codeLabel = await driver.findElement(By.id('detail-data'));
    const initialCode = await codeLabel.getText();
    expect(['CODE-1001', 'CODE-1002', 'CODE-1003']).toContain(initialCode);

    await safeClick(shuffleBtn);
    const newCode = await codeLabel.getText();
    expect(['CODE-1001', 'CODE-1002', 'CODE-1003']).toContain(newCode);
  });

  test('Feature 1: Location-Aware Card Matching (Geohash Spatial Indexing)', async () => {
    await driver.executeScript(`
      CardStore.add({
        name: 'Tesco Express',
        data: 'TESCO-8899',
        emoji: '🏬',
        locations: ['gcpvj0d']
      });
    `);

    await driver.navigate().refresh();

    const suggestedSection = await driver.wait(
      until.elementLocated(By.id('suggested-section')),
      5000
    );

    await driver.wait(async () => {
      const cls = await suggestedSection.getAttribute('class');
      return !cls.includes('hidden');
    }, 5000);

    const suggestedText = (await suggestedSection.getText()).toLowerCase();
    expect(suggestedText).toContain('suggested nearby');
    expect(suggestedText).toContain('tesco express');

    const statusBadge = await driver.findElement(By.id('location-status'));
    const badgeText = await statusBadge.getText();
    expect(badgeText).toContain('Near Tesco Express');
  });

  test('Feature 5: Instant Sharing & URL Import (JSURL Hash Serialization)', async () => {
    const sharedCard = {
      name: 'Shared Family Card',
      data: 'SHARE-9988',
      emoji: '🎁',
      color: '#f59e0b',
      locations: ['gcpvj0d']
    };

    const jsurlStr = await driver.executeScript(`
      return JSURL.stringify(${JSON.stringify(sharedCard)});
    `);

    const importUrl = `${serverInfo.url}/#card=${jsurlStr}`;
    await driver.get('about:blank');
    await driver.get(importUrl);

    const detailTitle = await driver.wait(until.elementLocated(By.id('detail-title')), 5000);
    const titleText = await driver.executeScript('return arguments[0].textContent;', detailTitle);
    expect(titleText).toContain('Shared Family Card');

    const backBtn = await driver.findElement(By.css('.back-btn'));
    await safeClick(backBtn);

    const tile = await driver.wait(until.elementLocated(By.css('.card-tile')), 5000);
    const tileText = await tile.getText();
    expect(tileText).toContain('Shared Family Card');
  });

  test('Feature 4: Built-In Camera Scanner Modal', async () => {
    const addBtn = await driver.findElement(By.id('add-btn'));
    await safeClick(addBtn);

    const scanBtn = await driver.findElement(By.id('scan-btn'));
    await safeClick(scanBtn);

    const scanModal = await driver.wait(until.elementLocated(By.id('scan-modal')), 5000);
    let modalClass = await scanModal.getAttribute('class');
    expect(modalClass).toContain('open');

    const video = await scanModal.findElement(By.id('scan-video'));
    expect(video).toBeDefined();

    const closeBtn = await driver.findElement(By.id('scan-close'));
    await safeClick(closeBtn);

    await driver.wait(async () => {
      const cls = await scanModal.getAttribute('class');
      return !cls.includes('open');
    }, 5000);
  });

  test('Feature 6: 100% Private & Client-Side (LocalStorage Storage Key)', async () => {
    const addBtn = await driver.findElement(By.id('add-btn'));
    await safeClick(addBtn);

    await driver.findElement(By.id('card-name')).sendKeys('Private Club');
    await driver.findElement(By.id('card-data')).sendKeys('PRIV-777');
    const submitBtn = await driver.findElement(By.id('add-submit-btn'));
    await safeClick(submitBtn);

    const storedRaw = await driver.executeScript(`
      return localStorage.getItem('magic-wallet-v1');
    `);

    expect(storedRaw).not.toBeNull();
    const storedList = JSON.parse(storedRaw);
    expect(storedList).toHaveLength(1);
    expect(storedList[0].name).toBe('Private Club');
    expect(storedList[0].data).toBe('PRIV-777');
  });

  test('Feature 7: Offline First & PWA Ready (SW Registration & Web App Manifest)', async () => {
    const manifestLink = await driver.findElement(By.css('link[rel="manifest"]'));
    const href = await manifestLink.getAttribute('href');
    expect(href).toContain('manifest.json');

    const swSupported = await driver.executeScript(`
      return ('serviceWorker' in navigator);
    `);
    expect(swSupported).toBe(true);
  });
});
