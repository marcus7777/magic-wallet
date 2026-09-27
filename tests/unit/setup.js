const fs = require('fs');
const path = require('path');

function setupEnvironment() {
  const qrcodeCode = fs.readFileSync(
    path.join(__dirname, '../../magic-wallet/vendor/qrcode.js'),
    'utf8'
  );
  const jsQRCode = fs.readFileSync(
    path.join(__dirname, '../../magic-wallet/vendor/jsQR.js'),
    'utf8'
  );
  const appCode = fs.readFileSync(
    path.join(__dirname, '../../magic-wallet/app.js'),
    'utf8'
  );

  // Set up minimal DOM structure as in index.html
  document.body.innerHTML = `
    <div id="app">
      <div id="screen-home" class="screen active">
        <span id="location-status" class="location-badge"></span>
        <button id="refresh-btn">🔄</button>
        <div id="suggested-section" class="suggested-section hidden">
          <div id="suggested-card"></div>
        </div>
        <div id="cards-list" class="cards-list"></div>
        <button id="add-btn" class="fab">+</button>
      </div>

      <div id="screen-add" class="screen">
        <h2 id="add-screen-title">New card</h2>
        <form id="add-form">
          <input type="text" id="card-emoji" value="💳" />
          <input type="text" id="card-name" required />
          <textarea id="card-data" required></textarea>
          <button type="button" id="scan-btn">📷</button>
          <input type="radio" name="card-format" id="card-format-qr" value="qr" checked />
          <input type="radio" name="card-format" id="card-format-barcode" value="barcode" />
          <input type="color" id="card-color" value="#6c63ff" />
          <div class="color-swatches">
            <button type="button" class="swatch" data-color="#6c63ff"></button>
          </div>
          <div id="qr-preview" class="qr-preview-box"></div>
          <p id="qr-hint" class="qr-hint"></p>
          <button type="submit" id="add-submit-btn">Save card</button>
        </form>
      </div>

      <div id="screen-detail" class="screen">
        <header id="detail-header">
          <button class="back-btn" data-target="home">←</button>
          <h2 id="detail-title"></h2>
          <button id="detail-edit-top">✏️</button>
          <button id="detail-share-top">🔗</button>
          <button id="detail-delete">🗑</button>
        </header>
        <div id="detail-qr" class="qr-code-wrap"></div>
        <button id="toggle-format-btn"><span id="toggle-format-label"></span></button>
        <p id="detail-data"></p>
        <p id="detail-multi-badge" class="multi-code-badge hidden"></p>
        <button id="shuffle-code-btn" class="hidden">🎲 Pick another code</button>
        <button id="use-here-btn"><span id="use-btn-label">📍 Used here</span></button>
        <button id="share-card-btn">🔗 Share card link</button>
        <p id="location-accuracy"></p>
        <div id="location-history"></div>
      </div>

      <div id="scan-modal" class="scan-modal">
        <button id="scan-close">✕</button>
        <video id="scan-video"></video>
        <canvas id="scan-canvas"></canvas>
        <p id="scan-status"></p>
      </div>
    </div>
  `;

  // Mock HTMLCanvasElement.prototype.getContext and HTMLMediaElement.prototype.play for JSDOM
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    drawImage: jest.fn(),
    getImageData: jest.fn().mockReturnValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 })
  });
  HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue();

  // Evaluate scripts in global scope
  window.eval(qrcodeCode);
  window.eval(jsQRCode);
  window.eval(appCode);
}

module.exports = { setupEnvironment };
