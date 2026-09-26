# 🪄 Magic Wallet

<p align="center">
  <img src="magic-wallet/icon.svg" width="100" height="100" alt="Magic Wallet Logo" />
</p>

<p align="center">
  <strong>A lightweight, privacy-focused, location-aware Web Application for managing loyalty cards and barcodes.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Web%20%2F%20PWA-blue" alt="Platform: Web / PWA" />
  <img src="https://img.shields.io/badge/Storage-100%25%20Local-green" alt="Storage: 100% Local" />
  <img src="https://img.shields.io/badge/License-MIT-purple" alt="License" />
</p>

---

## 🌐 Designed for the Web

**Magic Wallet** is built from the ground up to run seamlessly on the **web generally**, across any modern desktop or mobile browser—including Chrome, Firefox, Safari, and Edge.

As a Progressive Web App (PWA), it requires no app store downloads, works fully offline, and can be installed directly to your device's home screen or desktop.

---

## ✨ Features

* 📍 **Location-Aware Card Matching**: Automatically surface the right loyalty card when you walk into a shop using Geohash spatial matching (7-character precision, ~150m grid).
* 📱 **QR Code & 1D Barcode Rendering**: Seamlessly toggle between **QR Code** (`🔳`) and **1D Barcode** (`║▌║ Code128`) displays simply by tapping the code image or the format button.
* 🎲 **Multiple Codes per Card**: Store multiple barcode or QR code strings under a single store card (ideal for shared family accounts or multiple memberships).
* 📷 **Built-In Camera Scanner**: Instantly scan physical barcodes or QR codes using your device's camera.
* 🔗 **Instant Sharing & URL Import**: Share cards via compressed, privacy-friendly URL links (`#card=...`). Friends or family can click the link to automatically import or merge cards into their wallet.
* 🔒 **100% Private & Client-Side**: All card and location data remains exclusively in your browser's local storage (`localStorage`). No cloud servers, tracking, or accounts required.
* ⚡ **Offline First & PWA Ready**: Powered by a Service Worker that caches app shell assets, allowing full functionality even without an internet connection.
* 🎨 **Customizable Cards**: Personalize cards with custom colors and emojis for quick visual identification.

---

## 🚀 Getting Started

Since Magic Wallet is a client-side Web Application, you can run it using any web server or host it statically.

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/marcus7777/magic-wallet.git
   cd magic-wallet
   ```

2. **Serve the static files:**
   You can serve the `magic-wallet/` directory using any local HTTP server:
   ```bash
   npx http-server magic-wallet
   # or
   python3 -m http.server 8080 --directory magic-wallet
   ```

3. **Open in browser:**
   Navigate to `http://localhost:8080` in Chrome, Firefox, Safari, or Edge.

---

## 🛠 Tech Stack

* **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
* **Geolocation**: HTML5 Geolocation API + Geohash 7-character spatial indexing
* **QR & Barcode Utilities**: [`jsQR`](magic-wallet/vendor/jsQR.js) for camera scanning & [`qrcode-generator`](magic-wallet/vendor/qrcode.js) for rendering
* **URL Serialization**: `JSURL` for compact URL hash sharing
* **PWA / Storage**: Service Worker, Web App Manifest, and Browser `localStorage`

---

## 📱 Installing as a PWA

On mobile or desktop browsers:
1. Open Magic Wallet in your web browser.
2. Open the browser menu or tap the Share button.
3. Select **"Add to Home Screen"** or **"Install Magic Wallet"**.

---

## 📄 License

MIT License. Free to use and open source.
