/**
 * @jest-environment node
 */

const path = require('path');
const { By, until } = require('selenium-webdriver');
const { createStaticServer } = require('./server');
const { createDriver } = require('./driver-setup');

describe('Card Format Preference — Selenium E2E Tests', () => {
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
    serverInfo = await createStaticServer(staticPath, 8089);
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

  test('Selecting barcode format preference when creating card opens card in barcode format', async () => {
    const addBtn = await driver.findElement(By.id('add-btn'));
    await safeClick(addBtn);

    await driver.wait(until.elementLocated(By.id('screen-add')), 5000);

    await driver.findElement(By.id('card-name')).sendKeys('Explicit Barcode Store');
    await driver.findElement(By.id('card-data')).sendKeys('STORE-TEXT-CODE');

    // Select Barcode format preference radio
    const barcodeRadio = await driver.findElement(By.id('card-format-barcode'));
    await safeClick(barcodeRadio);

    // Submit form
    const submitBtn = await driver.findElement(By.id('add-submit-btn'));
    await safeClick(submitBtn);

    // Open card
    const cardTile = await driver.wait(until.elementLocated(By.css('.card-tile')), 5000);
    await safeClick(cardTile);

    // Verify detail screen opens in barcode format
    const detailQr = await driver.wait(until.elementLocated(By.id('detail-qr')), 5000);
    const wrapClass = await detailQr.getAttribute('class');
    expect(wrapClass).toContain('format-barcode');
  });

  test('Selecting QR format preference when creating card opens numeric card in QR format', async () => {
    const addBtn = await driver.findElement(By.id('add-btn'));
    await safeClick(addBtn);

    await driver.wait(until.elementLocated(By.id('screen-add')), 5000);

    await driver.findElement(By.id('card-name')).sendKeys('Explicit QR Numeric Store');
    await driver.findElement(By.id('card-data')).sendKeys('9876543210123');

    // Select QR format preference radio
    const qrRadio = await driver.findElement(By.id('card-format-qr'));
    await safeClick(qrRadio);

    // Submit form
    const submitBtn = await driver.findElement(By.id('add-submit-btn'));
    await safeClick(submitBtn);

    // Open card
    const cardTile = await driver.wait(until.elementLocated(By.css('.card-tile')), 5000);
    await safeClick(cardTile);

    // Verify detail screen opens in QR format
    const detailQr = await driver.wait(until.elementLocated(By.id('detail-qr')), 5000);
    const wrapClass = await detailQr.getAttribute('class');
    expect(wrapClass).toContain('format-qr');
  });
});
