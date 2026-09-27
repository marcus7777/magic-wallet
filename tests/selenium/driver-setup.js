const { Builder } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');

async function createDriver() {
  const options = new firefox.Options();
  options.addArguments('--headless');

  // Configure Firefox permissions (geolocation)
  options.setPreference('geo.enabled', true);
  options.setPreference('geo.provider.network.url', 'data:application/json,{"location":{"lat":51.5074,"lng":-0.1278},"accuracy":10.0}');
  options.setPreference('geo.prompt.testing', true);
  options.setPreference('geo.prompt.testing.allow', true);

  const driver = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(options)
    .build();

  // Set standard desktop/tablet window size for reliable element clicking
  await driver.manage().window().setRect({ width: 1024, height: 900 });
  return driver;
}

module.exports = { createDriver };
