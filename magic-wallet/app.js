'use strict';

/* ═══════════════════════════════════════════════════════════════
   CardStore — CRUD over localStorage
═══════════════════════════════════════════════════════════════ */
const CardStore = (() => {
  const KEY = 'magic-wallet-v1';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }

  function persist(cards) {
    localStorage.setItem(KEY, JSON.stringify(cards));
  }

  return {
    getAll: load,

    add(card) {
      const cards = load();
      const newCard = { ...card, id: uid(), locations: [] };
      cards.push(newCard);
      persist(cards);
      return newCard;
    },

    remove(id) {
      persist(load().filter(c => c.id !== id));
    },

    addLocation(id, lat, lon) {
      const cards = load();
      const card = cards.find(c => c.id === id);
      if (!card) return;
      card.locations = card.locations || [];
      card.locations.push({ lat, lon, usedAt: new Date().toISOString() });
      // Keep last 20 location records
      if (card.locations.length > 20) card.locations.splice(0, card.locations.length - 20);
      persist(cards);
      return cards.find(c => c.id === id);
    },

    getById(id) {
      return load().find(c => c.id === id) || null;
    }
  };
})();


/* ═══════════════════════════════════════════════════════════════
   Location — Geolocation + Haversine matching
═══════════════════════════════════════════════════════════════ */
const Location = (() => {
  const THRESHOLD_M = 150; // metres within which a card is "matched"

  function haversine(lat1, lon1, lat2, lon2) {
    const R   = 6_371_000; // Earth radius (metres)
    const φ1  = (lat1 * Math.PI) / 180;
    const φ2  = (lat2 * Math.PI) / 180;
    const Δφ  = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ  = ((lon2 - lon1) * Math.PI) / 180;
    const a   = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return {
    THRESHOLD_M,

    /** Returns { card, distance } for the nearest card within threshold, or null. */
    findNearest(cards, lat, lon) {
      let bestCard = null;
      let bestDist = Infinity;

      for (const card of cards) {
        for (const loc of (card.locations || [])) {
          const d = haversine(lat, lon, loc.lat, loc.lon);
          if (d < bestDist) { bestDist = d; bestCard = card; }
        }
      }

      return bestDist <= THRESHOLD_M
        ? { card: bestCard, distance: Math.round(bestDist) }
        : null;
    },

    /** Wraps navigator.geolocation.getCurrentPosition in a Promise. */
    getPosition() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          return reject(new Error('Geolocation not supported by this browser'));
        }
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => resolve({
            lat:      coords.latitude,
            lon:      coords.longitude,
            accuracy: Math.round(coords.accuracy),
          }),
          reject,
          { timeout: 9000, maximumAge: 60_000, enableHighAccuracy: true }
        );
      });
    }
  };
})();


/* ═══════════════════════════════════════════════════════════════
   QR — generates QR codes via qrcode-generator CDN lib
═══════════════════════════════════════════════════════════════ */
const QR = (() => {
  /** Creates and renders a QR SVG into `container`. Size is CSS-controlled. */
  function render(container, data) {
    container.innerHTML = '';
    if (!data || !data.trim()) return;

    // qrcode-generator: type 0 = auto, M = ~15% error correction
    // Escalate type if data is too long for auto
    let qr;
    for (const type of [0, 3, 6, 10, 15, 25, 40]) {
      try {
        qr = qrcode(type, 'M');
        qr.addData(data);
        qr.make();
        break;
      } catch (_) {
        qr = null;
      }
    }

    if (!qr) {
      container.innerHTML = '<p style="color:#888;font-size:.8rem;text-align:center">Data too long for QR</p>';
      return;
    }

    // createSvgTag(cellSize, margin) — we use cellSize=4 then scale via CSS
    const svg = qr.createSvgTag(4, 0);
    container.innerHTML = svg;

    // Make the SVG stretch to fill its CSS-constrained parent
    const svgEl = container.querySelector('svg');
    if (svgEl) {
      const count  = qr.getModuleCount();
      svgEl.setAttribute('viewBox', `0 0 ${count * 4} ${count * 4}`);
      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');
      svgEl.style.width  = '100%';
      svgEl.style.height = '100%';
    }
  }

  return { render };
})();


/* ═══════════════════════════════════════════════════════════════
   Scanner — camera-based QR / barcode reader
   Strategy: BarcodeDetector API first (Chrome/Edge, fast, native),
             jsQR fallback (pure JS, works everywhere with HTTPS).
═══════════════════════════════════════════════════════════════ */
const Scanner = (() => {
  let stream   = null;
  let rafId    = null;
  let detector = null; // BarcodeDetector instance (if available)

  // Build a BarcodeDetector that handles every common retail format
  const FORMATS = [
    'qr_code', 'aztec', 'data_matrix',
    'ean_13', 'ean_8', 'upc_a', 'upc_e',
    'code_128', 'code_39', 'code_93', 'codabar',
    'itf', 'pdf417',
  ];

  async function initDetector() {
    if (!('BarcodeDetector' in window)) return null;
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats   = FORMATS.filter(f => supported.includes(f));
      return new BarcodeDetector({ formats: formats.length ? formats : ['qr_code'] });
    } catch { return null; }
  }

  /** Open the scanner modal. Returns a Promise that resolves with the scanned string. */
  function open() {
    return new Promise((resolve, reject) => {
      const modal  = document.getElementById('scan-modal');
      const video  = document.getElementById('scan-video');
      const canvas = document.getElementById('scan-canvas');
      const status = document.getElementById('scan-status');
      const ctx    = canvas.getContext('2d', { willReadFrequently: true });

      modal.classList.add('open');
      status.textContent = 'Starting camera…';

      // Close button
      const closeBtn = document.getElementById('scan-close');
      const onClose  = () => { close(); reject(new Error('cancelled')); };
      closeBtn.addEventListener('click', onClose, { once: true });

      // Kick off camera
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } })
        .then(async s => {
          stream = s;
          video.srcObject = s;
          await video.play();

          detector = detector || await initDetector();
          status.textContent = detector
            ? 'Camera ready — scanning…'
            : 'Camera ready — scanning (jsQR fallback)…';

          // rAF loop
          const tick = async () => {
            if (!stream) return; // closed

            if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
              canvas.width  = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0);

              const result = await detectFrame(canvas, ctx);
              if (result) {
                closeBtn.removeEventListener('click', onClose);
                close();
                resolve(result);
                return;
              }
            }
            rafId = requestAnimationFrame(tick);
          };
          rafId = requestAnimationFrame(tick);
        })
        .catch(err => {
          close();
          reject(err);
        });
    });
  }

  /** Stop camera stream and hide modal. */
  function close() {
    if (rafId)  { cancelAnimationFrame(rafId); rafId = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    const modal = document.getElementById('scan-modal');
    if (modal)  modal.classList.remove('open');
  }

  /** Try BarcodeDetector → jsQR → null. */
  async function detectFrame(canvas, ctx) {
    // ① Native BarcodeDetector
    if (detector) {
      try {
        const codes = await detector.detect(canvas);
        if (codes.length) return codes[0].rawValue;
      } catch (_) { /* ignore transient errors */ }
    }

    // ② jsQR (CDN library)
    if (typeof jsQR !== 'undefined') {
      const { data: px, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(px, width, height, { inversionAttempts: 'dontInvert' });
      if (code) return code.data;
    }

    return null;
  }

  return { open, close };
})();


/* ═══════════════════════════════════════════════════════════════
   App — wires everything together
═══════════════════════════════════════════════════════════════ */
const App = (() => {
  let currentPos  = null; // { lat, lon, accuracy }
  let currentCard = null; // card object open in detail screen

  // ── Helpers ──────────────────────────────────────────────────

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg, durationMs = 2500) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('visible'), durationMs);
  }

  // ── Screen Routing ────────────────────────────────────────────

  function showScreen(name, direction = 'forward') {
    const outgoing = document.querySelector('.screen.active');
    const incoming = document.getElementById(`screen-${name}`);
    if (!incoming || outgoing === incoming) return;

    const run = () => {
      if (outgoing) {
        outgoing.classList.remove('active');
        if (direction !== 'back') {
          outgoing.classList.add('slide-back');
          outgoing.addEventListener('transitionend', () => {
            outgoing.classList.remove('slide-back');
          }, { once: true });
        }
      }
      incoming.classList.remove('slide-back');
      incoming.classList.add('active');
    };

    if (document.startViewTransition) {
      document.startViewTransition(run);
    } else {
      run();
    }
  }

  // ── Card HTML Helpers ─────────────────────────────────────────

  function cardTileHTML(card) {
    const locs = card.locations?.length || 0;
    return `
      <div class="card-tile" style="--card-color:${esc(card.color || '#6c63ff')}" data-id="${esc(card.id)}" tabindex="0" role="button" aria-label="Open ${esc(card.name)}">
        <div class="card-tile-inner">
          <span class="card-emoji">${esc(card.emoji || '💳')}</span>
          <div class="card-info">
            <span class="card-name">${esc(card.name)}</span>
            ${locs > 0
              ? `<span class="card-locs">📍 ${locs} location${locs !== 1 ? 's' : ''} saved</span>`
              : '<span class="card-locs">No location yet</span>'}
          </div>
          <span class="card-chevron">›</span>
        </div>
      </div>`;
  }

  function featuredCardHTML(card) {
    const locs = card.locations?.length || 0;
    return `
      <div class="card-tile card-tile--featured" style="--card-color:${esc(card.color || '#6c63ff')}" data-id="${esc(card.id)}" tabindex="0" role="button" aria-label="Open suggested card ${esc(card.name)}">
        <div class="card-tile-featured-inner">
          <div class="featured-info">
            <span class="card-emoji" style="font-size:2.2rem">${esc(card.emoji || '💳')}</span>
            <div class="card-name" style="font-size:1.15rem;font-weight:700;margin-top:6px">${esc(card.name)}</div>
            <div class="featured-hint">Tap to open full QR</div>
          </div>
          <div class="featured-qr" id="featured-qr-box"></div>
        </div>
      </div>`;
  }

  // ── Home Screen ───────────────────────────────────────────────

  function renderHome() {
    const cards = CardStore.getAll();
    renderCardsList(cards);

    // Location check
    const badge = document.getElementById('location-status');
    badge.textContent = '📍 locating…';
    badge.className   = 'location-badge';

    Location.getPosition()
      .then(pos => {
        currentPos = pos;
        const match = Location.findNearest(cards, pos.lat, pos.lon);

        if (match) {
          badge.textContent = `📍 Near ${match.card.name}`;
          badge.className   = 'location-badge location-badge--matched';
          showSuggested(match.card);
        } else {
          badge.textContent = '📍 Ready';
          badge.className   = 'location-badge';
          hideSuggested();
        }
      })
      .catch(() => {
        currentPos      = null;
        badge.textContent = '🚫 No location';
        badge.className   = 'location-badge location-badge--error';
        hideSuggested();
      });
  }

  function showSuggested(card) {
    const section = document.getElementById('suggested-section');
    const wrap    = document.getElementById('suggested-card');
    section.classList.remove('hidden');
    wrap.innerHTML = featuredCardHTML(card);

    // Render mini QR inside featured card
    const qrBox = document.getElementById('featured-qr-box');
    if (qrBox) QR.render(qrBox, card.data);

    wrap.querySelector('.card-tile').addEventListener('click', () => openCard(card.id));
    wrap.querySelector('.card-tile').addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') openCard(card.id);
    });
  }

  function hideSuggested() {
    document.getElementById('suggested-section').classList.add('hidden');
  }

  function renderCardsList(cards) {
    const list = document.getElementById('cards-list');

    if (cards.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <span class="empty-icon">🪄</span>
        <p>Your wallet is empty</p>
        <p class="empty-hint">Tap <strong>+</strong> to add your first loyalty card</p>
      </div>`;
      return;
    }

    list.innerHTML = cards.map(cardTileHTML).join('');
    list.querySelectorAll('.card-tile').forEach(el => {
      el.addEventListener('click', () => openCard(el.dataset.id));
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') openCard(el.dataset.id);
      });
    });
  }

  // ── Card Detail Screen ────────────────────────────────────────

  function openCard(id) {
    const card = CardStore.getById(id);
    if (!card) return;
    currentCard = card;

    // Header accent
    const header = document.getElementById('detail-header');
    header.style.borderTopColor = card.color || '#6c63ff';

    document.getElementById('detail-title').textContent = `${card.emoji || '💳'} ${card.name}`;
    document.getElementById('detail-data').textContent  = card.data;

    // Render QR
    QR.render(document.getElementById('detail-qr'), card.data);

    // Location accuracy hint
    const accEl = document.getElementById('location-accuracy');
    if (currentPos) {
      accEl.textContent = `Current accuracy ±${currentPos.accuracy}m · Within ${Location.THRESHOLD_M}m counts as "here"`;
    } else {
      accEl.textContent = 'Location unavailable — tap Used here to try again';
    }

    renderLocationHistory(card);
    showScreen('detail');
  }

  function renderLocationHistory(card) {
    const wrap = document.getElementById('location-history');
    const locs = card.locations || [];

    if (locs.length === 0) {
      wrap.innerHTML = `<p class="location-info-small" style="margin-top:8px">
        No locations saved yet.<br>Tap "Used here" the next time you scan this card at a shop.
      </p>`;
      return;
    }

    wrap.innerHTML = `<p class="section-label" style="margin-top:8px">Where you've used this</p>` +
      locs.slice().reverse().map(l => {
        const date = new Date(l.usedAt);
        return `<div class="loc-entry">
          <span>📍 ${l.lat.toFixed(5)}, ${l.lon.toFixed(5)}</span>
          <span class="loc-date">${date.toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' })}</span>
        </div>`;
      }).join('');
  }

  // ── "Used here" ───────────────────────────────────────────────

  async function useHere() {
    if (!currentCard) return;

    const btn   = document.getElementById('use-here-btn');
    const label = document.getElementById('use-btn-label');
    btn.disabled   = true;
    label.textContent = '📍 Getting location…';

    try {
      const pos  = await Location.getPosition();
      currentPos = pos;
      const updated = CardStore.addLocation(currentCard.id, pos.lat, pos.lon);
      currentCard   = updated || currentCard;

      label.textContent = '✓ Saved!';
      btn.classList.add('btn--success');
      toast('Location saved — we\'ll suggest this card next time you\'re here 📍');

      setTimeout(() => {
        btn.disabled          = false;
        label.textContent     = '📍 Used here';
        btn.classList.remove('btn--success');
        renderLocationHistory(currentCard);
        document.getElementById('location-accuracy').textContent =
          `Current accuracy ±${pos.accuracy}m · Within ${Location.THRESHOLD_M}m counts as "here"`;
      }, 2000);
    } catch (err) {
      btn.disabled      = false;
      label.textContent = '📍 Used here';
      toast('⚠️ Couldn\'t get location — check permissions');
    }
  }

  // ── Add Card Screen ───────────────────────────────────────────

  function initAddForm() {
    const dataInput  = document.getElementById('card-data');
    const colorInput = document.getElementById('card-color');
    const preview    = document.getElementById('qr-preview');
    const hint       = document.getElementById('qr-hint');

    // Live QR preview
    dataInput.addEventListener('input', () => {
      const val = dataInput.value.trim();
      if (val) {
        hint.textContent = '';
        QR.render(preview, val);
      } else {
        preview.innerHTML = '';
        hint.textContent  = 'Enter card data above to preview';
      }
    });

    // ── Scan button ────────────────────────────────────────────
    const scanBtn = document.getElementById('scan-btn');

    if (!navigator.mediaDevices?.getUserMedia) {
      // No camera API — hide button gracefully
      scanBtn.style.display = 'none';
    } else {
      scanBtn.addEventListener('click', async () => {
        try {
          const scanned = await Scanner.open();
          // Populate the input and fire the input event so QR preview updates
          dataInput.value = scanned;
          dataInput.dispatchEvent(new Event('input'));
          toast('✓ Scanned! Check the data and save your card.');
        } catch (err) {
          if (err.message === 'cancelled') return; // user closed modal
          if (err.name === 'NotAllowedError') {
            toast('⚠️ Camera permission denied — enter data manually');
          } else if (err.name === 'NotFoundError') {
            toast('⚠️ No camera found on this device');
          } else {
            toast('⚠️ Camera error — try entering data manually');
          }
        }
      });
    }

    // Colour swatches
    document.querySelectorAll('.swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        colorInput.value = btn.dataset.color;
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    // Mark first swatch active by default
    const first = document.querySelector('.swatch');
    if (first) first.classList.add('active');

    // Sync colour picker → swatches
    colorInput.addEventListener('input', () => {
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    });

    // Form submit
    document.getElementById('add-form').addEventListener('submit', e => {
      e.preventDefault();
      const name  = document.getElementById('card-name').value.trim();
      const data  = document.getElementById('card-data').value.trim();
      const emoji = document.getElementById('card-emoji').value.trim() || '💳';
      const color = colorInput.value;

      if (!name || !data) {
        toast('⚠️ Please fill in shop name and card data');
        return;
      }

      CardStore.add({ name, data, emoji, color });
      document.getElementById('add-form').reset();
      document.getElementById('card-emoji').value = '💳';
      preview.innerHTML = '';
      hint.textContent  = 'Enter card data above to preview';

      showScreen('home', 'back');
      renderHome();
      toast(`✓ ${emoji} ${name} added to your wallet`);
    });
  }

  // ── Event Binding ─────────────────────────────────────────────

  function bindGlobalEvents() {
    // FAB → add screen
    document.getElementById('add-btn').addEventListener('click', () => showScreen('add'));

    // Back buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        showScreen('home', 'back');
        renderHome();
      });
    });

    // Delete button
    document.getElementById('detail-delete').addEventListener('click', () => {
      if (!currentCard) return;
      if (confirm(`Delete "${currentCard.name}"? This cannot be undone.`)) {
        CardStore.remove(currentCard.id);
        showScreen('home', 'back');
        renderHome();
        toast(`🗑 ${currentCard.name} removed`);
        currentCard = null;
      }
    });

    // Used here button
    document.getElementById('use-here-btn').addEventListener('click', useHere);
  }

  // ── Public init ───────────────────────────────────────────────

  return {
    init() {
      bindGlobalEvents();
      initAddForm();
      renderHome();
    }
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
