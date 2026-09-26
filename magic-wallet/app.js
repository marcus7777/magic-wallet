'use strict';

/* ═══════════════════════════════════════════════════════════════
   JSURL — Sage/jsurl official implementation & integration
═══════════════════════════════════════════════════════════════ */
const JSURL = window.JSURL || (() => {
  const exports = {};
  (function(exports) {
    'use strict';
    exports.stringify = function stringify(v) {
      function encode(s) {
        return !/[^\w-.]/.test(s) ? s : s.replace(/[^\w-.]/g, function(ch) {
          if (ch === '$') return '!';
          ch = ch.charCodeAt(0);
          return ch < 0x100 ? '*' + ('00' + ch.toString(16)).slice(-2) : '**' + ('0000' + ch.toString(16)).slice(-4);
        });
      }

      var tmpAry;

      switch (typeof v) {
        case 'number':
          return isFinite(v) ? '~' + v : '~null';
        case 'boolean':
          return '~' + v;
        case 'string':
          return "~'" + encode(v);
        case 'object':
          if (!v) return '~null';

          tmpAry = [];

          if (Array.isArray(v)) {
            for (var i = 0; i < v.length; i++) {
              tmpAry[i] = stringify(v[i]) || '~null';
            }

            return '~(' + (tmpAry.join('') || '~') + ')';
          } else {
            for (var key in v) {
              if (v.hasOwnProperty(key)) {
                var val = stringify(v[key]);

                if (val) {
                  tmpAry.push(encode(key) + val);
                }
              }
            }

            return '~(' + tmpAry.join('~') + ')';
          }
        default:
          return;
      }
    };

    var reserved = {
      'true': true,
      'false': false,
      'null': null
    };

    exports.parse = function(s) {
      if (!s) return s;
      s = s.replace(/%(25)*27/g, "'");
      var i = 0,
        len = s.length;

      function eat(expected) {
        if (s.charAt(i) !== expected) throw new Error('bad JSURL syntax: expected ' + expected + ', got ' + (s && s.charAt(i)));
        i++;
      }

      function decode() {
        var beg = i,
          ch, r = '';
        while (i < len && (ch = s.charAt(i)) !== '~' && ch !== ')') {
          switch (ch) {
            case '*':
              if (beg < i) r += s.substring(beg, i);
              if (s.charAt(i + 1) === '*') r += String.fromCharCode(parseInt(s.substring(i + 2, i + 6), 16)), beg = (i += 6);
              else r += String.fromCharCode(parseInt(s.substring(i + 1, i + 3), 16)), beg = (i += 3);
              break;
            case '!':
              if (beg < i) r += s.substring(beg, i);
              r += '$', beg = ++i;
              break;
            default:
              i++;
          }
        }
        return r + s.substring(beg, i);
      }

      return (function parseOne() {
        var result, ch, beg;
        eat('~');
        switch (ch = s.charAt(i)) {
          case '(':
            i++;
            if (s.charAt(i) === '~') {
              result = [];
              if (s.charAt(i + 1) === ')') i++;
              else {
                do {
                  result.push(parseOne());
                } while (s.charAt(i) === '~');
              }
            } else {
              result = {};
              if (s.charAt(i) !== ')') {
                do {
                  var key = decode();
                  result[key] = parseOne();
                } while (s.charAt(i) === '~' && ++i);
              }
            }
            eat(')');
            break;
          case "'":
            i++;
            result = decode();
            break;
          default:
            beg = i++;
            while (i < len && /[^)~]/.test(s.charAt(i)))
            i++;
            var sub = s.substring(beg, i);
            if (/[\d\-]/.test(ch)) {
              result = parseFloat(sub);
            } else {
              result = reserved[sub];
              if (typeof result === 'undefined') throw new Error('bad value keyword: ' + sub);
            }
        }
        return result;
      })();
    };
  })(exports);
  return exports;
})();


/* ═══════════════════════════════════════════════════════════════
   Geohash — 7-character base32 encoding & 8-neighbor lookup
═══════════════════════════════════════════════════════════════ */
const Geohash = (() => {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

  /** Encodes latitude and longitude to a geohash string of length `precision` (default 7). */
  function encode(lat, lon, precision = 7) {
    let latMin = -90, latMax = 90;
    let lonMin = -180, lonMax = 180;
    let hash = '';
    let bit = 0;
    let ch = 0;
    let isEven = true;

    while (hash.length < precision) {
      if (isEven) {
        const mid = (lonMin + lonMax) / 2;
        if (lon >= mid) {
          ch |= (1 << (4 - bit));
          lonMin = mid;
        } else {
          lonMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if (lat >= mid) {
          ch |= (1 << (4 - bit));
          latMin = mid;
        } else {
          latMax = mid;
        }
      }

      isEven = !isEven;
      if (bit < 4) {
        bit++;
      } else {
        hash += BASE32[ch];
        bit = 0;
        ch = 0;
      }
    }
    return hash;
  }

  /** Decodes a geohash string into bounding box and center coordinate. */
  function decode(geohash) {
    let latMin = -90, latMax = 90;
    let lonMin = -180, lonMax = 180;
    let isEven = true;

    for (let i = 0; i < geohash.length; i++) {
      const c = geohash[i];
      const cd = BASE32.indexOf(c);
      if (cd === -1) continue;

      for (let j = 4; j >= 0; j--) {
        const bit = (cd >> j) & 1;
        if (isEven) {
          const mid = (lonMin + lonMax) / 2;
          if (bit === 1) lonMin = mid;
          else lonMax = mid;
        } else {
          const mid = (latMin + latMax) / 2;
          if (bit === 1) latMin = mid;
          else latMax = mid;
        }
        isEven = !isEven;
      }
    }

    const lat = (latMin + latMax) / 2;
    const lon = (lonMin + lonMax) / 2;
    return { latMin, latMax, lonMin, lonMax, lat, lon };
  }

  /** Returns 9 geohashes: center + 8 surrounding neighbor geohashes. */
  function getNeighbors(geohash) {
    const { latMin, latMax, lonMin, lonMax, lat, lon } = decode(geohash);
    const dLat = latMax - latMin;
    const dLon = lonMax - lonMin;
    const precision = geohash.length;

    const neighbors = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        let nLat = lat + dy * dLat;
        let nLon = lon + dx * dLon;

        if (nLon > 180) nLon -= 360;
        if (nLon < -180) nLon += 360;
        if (nLat > 90) nLat = 90;
        if (nLat < -90) nLat = -90;

        neighbors.push(encode(nLat, nLon, precision));
      }
    }
    return [...new Set(neighbors)];
  }

  /** Gets center geohash and all 8 surrounding neighbor geohashes for a lat, lon point. */
  function getNearbyGeohashes(lat, lon, precision = 7) {
    const center = encode(lat, lon, precision);
    const all = getNeighbors(center);
    return { center, all };
  }

  return { encode, decode, getNeighbors, getNearbyGeohashes };
})();


/* ═══════════════════════════════════════════════════════════════
   Card Data Helpers — support multiple codes per card
═══════════════════════════════════════════════════════════════ */
function parseCardData(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(s => String(s).trim()).filter(Boolean);
  }
  return String(input)
    .split(/[\r\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeCardDataForSave(input) {
  const items = parseCardData(input);
  if (items.length <= 1) return items[0] || '';
  return items;
}


/* ═══════════════════════════════════════════════════════════════
   CardStore — CRUD over localStorage with 7-char Geohash storage
═══════════════════════════════════════════════════════════════ */
const CardStore = (() => {
  const KEY = 'magic-wallet-v1';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      let needsPersist = false;

      // Migrate existing cards if needed (e.g. old {lat, lon} objects to 7-char geohashes)
      const cards = raw.map(card => {
        if (!card.locations || !Array.isArray(card.locations)) {
          card.locations = [];
        } else {
          const migratedLocs = [];
          for (const loc of card.locations) {
            if (typeof loc === 'string') {
              const gh = loc.slice(0, 7);
              if (gh.length === 7 && !migratedLocs.includes(gh)) migratedLocs.push(gh);
            } else if (loc && typeof loc === 'object' && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
              const gh = Geohash.encode(loc.lat, loc.lon, 7);
              if (!migratedLocs.includes(gh)) migratedLocs.push(gh);
              needsPersist = true;
            }
          }
          if (JSON.stringify(migratedLocs) !== JSON.stringify(card.locations)) {
            card.locations = migratedLocs;
            needsPersist = true;
          }
        }
        return card;
      });

      if (needsPersist) persist(cards);
      return cards;
    } catch {
      return [];
    }
  }

  function persist(cards) {
    try {
      localStorage.setItem(KEY, JSON.stringify(cards));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
  }

  return {
    getAll: load,

    add(card) {
      const cards = load();
      const name = String(card.name || '').trim();
      const dataForSave = normalizeCardDataForSave(card.data);
      const dataStr = parseCardData(card.data).join('\n');
      const color = String(card.color || '#6c63ff').trim().toLowerCase();
      const emoji = card.emoji || '💳';
      const locs = Array.isArray(card.locations)
        ? card.locations.map(l => String(l).slice(0, 7)).filter(l => l.length === 7)
        : [];

      const existingCard = cards.find(c =>
        String(c.name || '').trim() === name &&
        parseCardData(c.data).join('\n') === dataStr &&
        String(c.color || '').trim().toLowerCase() === color
      );

      if (existingCard) {
        existingCard.locations = existingCard.locations || [];
        const mergedLocs = [...new Set([...existingCard.locations, ...locs])];
        if (mergedLocs.length > 20) {
          mergedLocs.splice(0, mergedLocs.length - 20);
        }
        existingCard.locations = mergedLocs;
        if (emoji && emoji !== '💳' && existingCard.emoji === '💳') {
          existingCard.emoji = emoji;
        }
        persist(cards);
        return { ...existingCard, isMerged: true };
      }

      const newCard = {
        id: uid(),
        name: card.name,
        data: dataForSave,
        emoji: emoji,
        color: card.color || '#6c63ff',
        locations: [...new Set(locs)]
      };
      cards.push(newCard);
      persist(cards);
      return newCard;
    },

    remove(id) {
      persist(load().filter(c => c.id !== id));
    },

    addLocationGeohash(id, geohash) {
      const cards = load();
      const card = cards.find(c => c.id === id);
      if (!card) return;
      card.locations = card.locations || [];
      const gh7 = String(geohash).slice(0, 7);
      if (gh7.length === 7 && !card.locations.includes(gh7)) {
        card.locations.push(gh7);
        if (card.locations.length > 20) card.locations.splice(0, card.locations.length - 20);
        persist(cards);
      }
      return card;
    },

    getById(id) {
      return load().find(c => c.id === id) || null;
    },

    update(id, updates) {
      const cards = load();
      const card = cards.find(c => c.id === id);
      if (!card) return null;

      if (updates.name !== undefined) card.name = String(updates.name).trim();
      if (updates.data !== undefined) card.data = normalizeCardDataForSave(updates.data);
      if (updates.emoji !== undefined) card.emoji = String(updates.emoji).trim() || '💳';
      if (updates.color !== undefined) card.color = String(updates.color).trim();

      persist(cards);
      return card;
    }
  };
})();


/* ═══════════════════════════════════════════════════════════════
   Location — Geolocation + Geohash 7-char matching (exact + 8 neighbors)
═══════════════════════════════════════════════════════════════ */
const Location = (() => {
  let cachedPos = null;
  let cachedPosTime = 0;
  let pendingPromise = null;

  return {
    /**
     * Checks if current location (lat, lon) matches any card location geohash
     * by checking exact match on center geohash and then the 8 surrounding geohashes.
     */
    findNearest(cards, lat, lon) {
      const { center, all } = Geohash.getNearbyGeohashes(lat, lon, 7);

      // 1. Exact match on center geohash
      for (const card of cards) {
        if (Array.isArray(card.locations) && card.locations.includes(center)) {
          return { card, matchType: 'exact', geohash: center };
        }
      }

      // 2. Eight surrounding geohashes match
      for (const card of cards) {
        if (Array.isArray(card.locations)) {
          const matchedGh = card.locations.find(gh => all.includes(gh));
          if (matchedGh) {
            return { card, matchType: 'nearby', geohash: matchedGh };
          }
        }
      }

      return null;
    },

    /**
     * Gets current position cached or via navigator.geolocation.
     * Handles Firefox-specific fallback (POSITION_UNAVAILABLE & TIMEOUT)
     * and deduplicates concurrent geolocation calls.
     */
    getPosition(options = {}) {
      const forceFresh = options.forceFresh || false;
      const cacheMaxAgeMs = options.cacheMaxAgeMs || 120_000;
      const now = Date.now();

      if (!forceFresh && cachedPos && (now - cachedPosTime < cacheMaxAgeMs)) {
        return Promise.resolve(cachedPos);
      }

      if (pendingPromise) {
        return pendingPromise;
      }

      pendingPromise = new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          pendingPromise = null;
          return reject(new Error('Geolocation not supported by this browser'));
        }

        const handleSuccess = ({ coords }) => {
          const pos = {
            lat:      coords.latitude,
            lon:      coords.longitude,
            accuracy: Math.round(coords.accuracy),
            timestamp: Date.now()
          };
          cachedPos = pos;
          cachedPosTime = pos.timestamp;
          pendingPromise = null;
          resolve(pos);
        };

        const handlePrimaryError = (err) => {
          if (err && err.code === 1 /* PERMISSION_DENIED */) {
            pendingPromise = null;
            return reject(err);
          }

          // Firefox desktop/mobile commonly returns POSITION_UNAVAILABLE (2) or TIMEOUT (3)
          // when enableHighAccuracy: true is requested without dedicated GPS hardware.
          // Retry with low accuracy (enableHighAccuracy: false) and extended timeout & maximumAge.
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            (fallbackErr) => {
              pendingPromise = null;
              if (cachedPos) {
                resolve(cachedPos);
              } else {
                reject(fallbackErr);
              }
            },
            { timeout: 15000, maximumAge: 300_000, enableHighAccuracy: false }
          );
        };

        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          handlePrimaryError,
          { timeout: 8000, maximumAge: 60_000, enableHighAccuracy: true }
        );
      });

      return pendingPromise;
    },

    getCachedPosition() {
      return cachedPos;
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
    if (typeof qrcode === 'undefined') {
      container.innerHTML = '<p style="color:#888;font-size:.8rem;text-align:center">QR library loading…</p>';
      return;
    }

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

    const svg = qr.createSvgTag(4, 0);
    container.innerHTML = svg;

    const svgEl = container.querySelector('svg');
    if (svgEl) {
      const count = qr.getModuleCount();
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
   Barcode — generates 1D Code128 vector barcodes as SVG
═══════════════════════════════════════════════════════════════ */
const Barcode = (() => {
  const PATTERNS = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','411112','134111','111242',
    '121142','121241','114212','124112','124211','411212','421112','421211','212141','214121',
    '412121','111143','111341','131141','114113','114311','411113','411311','113141','114131',
    '311141','411131','211412','211214','211232','2331112'
  ];

  function encode(data) {
    if (!data || typeof data !== 'string') return null;
    const cleanData = data.trim();
    if (!cleanData) return null;

    const isAllDigits = /^\d+$/.test(cleanData);
    const symbols = [];

    if (isAllDigits && cleanData.length >= 2) {
      symbols.push(104);
      let i = 0;
      while (i < cleanData.length) {
        if (i <= cleanData.length - 2) {
          const val = parseInt(cleanData.slice(i, i + 2), 10);
          symbols.push(val);
          i += 2;
        } else {
          symbols.push(100);
          symbols.push(cleanData.charCodeAt(i) - 32);
          i++;
        }
      }
    } else {
      symbols.push(103);
      for (let i = 0; i < cleanData.length; i++) {
        const code = cleanData.charCodeAt(i);
        if (code >= 32 && code <= 126) {
          symbols.push(code - 32);
        } else {
          symbols.push(31);
        }
      }
    }

    let checksum = symbols[0];
    for (let i = 1; i < symbols.length; i++) {
      checksum += symbols[i] * i;
    }
    symbols.push(checksum % 103);
    symbols.push(105);

    let moduleStr = '';
    for (const symIdx of symbols) {
      const pat = PATTERNS[symIdx];
      if (!pat) return null;
      let isBar = true;
      for (let j = 0; j < pat.length; j++) {
        const w = parseInt(pat[j], 10);
        moduleStr += (isBar ? '1' : '0').repeat(w);
        isBar = !isBar;
      }
    }

    return moduleStr;
  }

  function render(container, data) {
    container.innerHTML = '';
    if (!data || !data.trim()) return;

    const moduleStr = encode(data);
    if (!moduleStr) {
      container.innerHTML = '<p style="color:#888;font-size:.8rem;text-align:center">Unable to render barcode</p>';
      return;
    }

    const quietZone = 10;
    const totalModules = moduleStr.length + quietZone * 2;
    const barHeight = 70;
    const svgWidth = totalModules * 2;
    const svgHeight = barHeight + 24;

    let rectsHTML = '';
    let inBar = false;
    let barStart = 0;

    for (let i = 0; i < moduleStr.length; i++) {
      const isBlack = moduleStr[i] === '1';
      if (isBlack && !inBar) {
        inBar = true;
        barStart = i;
      } else if (!isBlack && inBar) {
        inBar = false;
        const width = i - barStart;
        const x = (quietZone + barStart) * 2;
        rectsHTML += `<rect x="${x}" y="8" width="${width * 2}" height="${barHeight}" fill="#000" />`;
      }
    }
    if (inBar) {
      const width = moduleStr.length - barStart;
      const x = (quietZone + barStart) * 2;
      rectsHTML += `<rect x="${x}" y="8" width="${width * 2}" height="${barHeight}" fill="#000" />`;
    }

    const cleanLabel = data.trim();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%;height:auto;max-height:140px;background:#fff;border-radius:8px;padding:6px;box-sizing:border-box;">
      <rect width="100%" height="100%" fill="#fff" rx="8" />
      ${rectsHTML}
      <text x="50%" y="${svgHeight - 2}" font-family="monospace" font-size="11" font-weight="bold" fill="#000" text-anchor="middle">${cleanLabel}</text>
    </svg>`;

    container.innerHTML = svg;
  }

  return { render };
})();


/* ═══════════════════════════════════════════════════════════════
   Scanner — camera-based QR / barcode reader
═══════════════════════════════════════════════════════════════ */
const Scanner = (() => {
  let stream   = null;
  let rafId    = null;
  let detector = null;

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

  function open() {
    return new Promise((resolve, reject) => {
      const modal  = document.getElementById('scan-modal');
      const video  = document.getElementById('scan-video');
      const canvas = document.getElementById('scan-canvas');
      const status = document.getElementById('scan-status');
      const ctx    = canvas.getContext('2d', { willReadFrequently: true });

      modal.classList.add('open');
      status.textContent = 'Starting camera…';

      const closeBtn = document.getElementById('scan-close');
      const onClose  = () => { close(); reject(new Error('cancelled')); };
      closeBtn.addEventListener('click', onClose, { once: true });

      const getStream = () => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } })
        .catch(() => navigator.mediaDevices.getUserMedia({ video: true }));

      getStream()
        .then(async s => {
          stream = s;
          video.srcObject = s;
          try {
            await video.play();
          } catch (_) {}

          detector = detector || await initDetector();
          status.textContent = detector
            ? 'Camera ready — scanning…'
            : 'Camera ready — scanning (jsQR fallback)…';

          const tick = async () => {
            if (!stream) return;

            if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
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

  function close() {
    if (rafId)  { cancelAnimationFrame(rafId); rafId = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    const modal = document.getElementById('scan-modal');
    if (modal)  modal.classList.remove('open');
  }

  async function detectFrame(canvas, ctx) {
    if (detector) {
      try {
        const codes = await detector.detect(canvas);
        if (codes.length) return codes[0].rawValue;
      } catch (_) { }
    }

    if (typeof jsQR !== 'undefined' && canvas.width > 0 && canvas.height > 0) {
      try {
        const { data: px, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (px && width > 0 && height > 0) {
          const code = jsQR(px, width, height, { inversionAttempts: 'dontInvert' });
          if (code) return code.data;
        }
      } catch (_) {}
    }

    return null;
  }

  return { open, close };
})();


/* ═══════════════════════════════════════════════════════════════
   App — wires everything together
═══════════════════════════════════════════════════════════════ */
const App = (() => {
  let currentPos    = null; // { lat, lon, accuracy }
  let currentCard   = null; // card object open in detail screen
  let editingCardId = null; // card ID when editing, null when creating

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

    if (typeof document.startViewTransition === 'function') {
      try {
        document.startViewTransition(run);
      } catch (_) {
        run();
      }
    } else {
      run();
    }
  }

  // ── Card HTML Helpers ─────────────────────────────────────────

  function cardTileHTML(card) {
    const locs = card.locations?.length || 0;
    const codesCount = parseCardData(card.data).length;
    const codesBadge = codesCount > 1 ? ` · 🎲 ${codesCount} codes` : '';
    return `
      <div class="card-tile" style="--card-color:${esc(card.color || '#6c63ff')}" data-id="${esc(card.id)}" tabindex="0" role="button" aria-label="Open ${esc(card.name)}">
        <div class="card-tile-inner">
          <span class="card-emoji">${esc(card.emoji || '💳')}</span>
          <div class="card-info">
            <span class="card-name">${esc(card.name)}</span>
            ${locs > 0
              ? `<span class="card-locs">📍 ${locs} location${locs !== 1 ? 's' : ''} saved${codesBadge}</span>`
              : `<span class="card-locs">No location yet${codesBadge}</span>`}
          </div>
          <span class="card-chevron">›</span>
        </div>
      </div>`;
  }

  function featuredCardHTML(card) {
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

    if (currentPos) {
      const match = Location.findNearest(cards, currentPos.lat, currentPos.lon);
      if (match) {
        badge.textContent = match.matchType === 'exact'
          ? `📍 Near ${match.card.name} (exact)`
          : `📍 Near ${match.card.name}`;
        badge.className   = 'location-badge location-badge--matched';
        showSuggested(match.card);
      } else {
        badge.textContent = '📍 Ready';
        badge.className   = 'location-badge';
        hideSuggested();
      }
    } else {
      badge.textContent = '📍 locating…';
      badge.className   = 'location-badge';
    }

    Location.getPosition()
      .then(pos => {
        currentPos = pos;
        const match = Location.findNearest(cards, pos.lat, pos.lon);

        if (match) {
          badge.textContent = match.matchType === 'exact'
            ? `📍 Near ${match.card.name} (exact)`
            : `📍 Near ${match.card.name}`;
          badge.className   = 'location-badge location-badge--matched';
          showSuggested(match.card);
        } else {
          badge.textContent = '📍 Ready';
          badge.className   = 'location-badge';
          hideSuggested();
        }
      })
      .catch(err => {
        if (!currentPos || (err && err.code === 1 /* PERMISSION_DENIED */)) {
          currentPos        = null;
          badge.textContent = '🚫 No location';
          badge.className   = 'location-badge location-badge--error';
          hideSuggested();
        }
      });
  }

  function showSuggested(card) {
    const section = document.getElementById('suggested-section');
    const wrap    = document.getElementById('suggested-card');
    section.classList.remove('hidden');
    wrap.innerHTML = featuredCardHTML(card);

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

  let activeDataIndex = 0;
  let currentCodeFormat = 'qr'; // 'qr' or 'barcode'

  function renderCardCode(card, index, format) {
    if (format) currentCodeFormat = format;

    const items = parseCardData(card.data);
    const wrap = document.getElementById('detail-qr');
    const badge = document.getElementById('detail-multi-badge');
    const shuffleBtn = document.getElementById('shuffle-code-btn');

    if (!items.length) {
      document.getElementById('detail-data').textContent = '';
      if (wrap) wrap.innerHTML = '';
      if (badge) badge.classList.add('hidden');
      if (shuffleBtn) shuffleBtn.classList.add('hidden');
      return;
    }

    activeDataIndex = ((index % items.length) + items.length) % items.length;
    const activeData = items[activeDataIndex];

    document.getElementById('detail-data').textContent = activeData;

    if (wrap) {
      if (currentCodeFormat === 'barcode') {
        wrap.className = 'qr-code-wrap format-barcode';
        Barcode.render(wrap, activeData);
      } else {
        wrap.className = 'qr-code-wrap format-qr';
        QR.render(wrap, activeData);
      }
    }

    const toggleLabel = document.getElementById('toggle-format-label');
    if (toggleLabel) {
      toggleLabel.textContent = currentCodeFormat === 'barcode'
        ? '🔳 Switch to QR Code'
        : '║▌║ Switch to Barcode';
    }

    if (items.length > 1) {
      if (badge) {
        badge.textContent = `🎲 Code ${activeDataIndex + 1} of ${items.length} (randomized)`;
        badge.classList.remove('hidden');
      }
      if (shuffleBtn) {
        shuffleBtn.classList.remove('hidden');
      }
    } else {
      if (badge) badge.classList.add('hidden');
      if (shuffleBtn) shuffleBtn.classList.add('hidden');
    }
  }

  function toggleCodeFormat() {
    if (!currentCard) return;
    currentCodeFormat = (currentCodeFormat === 'qr') ? 'barcode' : 'qr';
    renderCardCode(currentCard, activeDataIndex, currentCodeFormat);
    const formatName = currentCodeFormat === 'barcode' ? 'Barcode ║▌║' : 'QR Code 🔳';
    toast(`Switched to ${formatName}`);
  }

  function openCard(id) {
    const card = CardStore.getById(id);
    if (!card) return;
    currentCard = card;

    const header = document.getElementById('detail-header');
    header.style.borderTopColor = card.color || '#6c63ff';

    document.getElementById('detail-title').textContent = `${card.emoji || '💳'} ${card.name}`;

    const items = parseCardData(card.data);
    const randomIndex = items.length > 1 ? Math.floor(Math.random() * items.length) : 0;

    const firstCode = items[0] || '';
    if (/^\d{8,18}$/.test(firstCode.trim())) {
      currentCodeFormat = 'barcode';
    } else {
      currentCodeFormat = 'qr';
    }

    renderCardCode(card, randomIndex, currentCodeFormat);

    const accEl = document.getElementById('location-accuracy');
    if (currentPos) {
      const currentGh = Geohash.encode(currentPos.lat, currentPos.lon, 7);
      accEl.textContent = `Current area: ${currentGh} · Matching checks exact cell & 8 adjacent neighbors (~150m)`;
    } else {
      accEl.textContent = 'Location unavailable — tap Used here to save current area';
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

    wrap.innerHTML = `<p class="section-label" style="margin-top:8px">Saved Location Geohashes (7-char)</p>` +
      locs.slice().reverse().map(gh => {
        return `<div class="loc-entry">
          <span>📍 <code>${esc(gh)}</code></span>
          <span class="loc-date">Geohash cell (~150m)</span>
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
      const pos  = await Location.getPosition({ forceFresh: true });
      currentPos = pos;
      const geohash = Geohash.encode(pos.lat, pos.lon, 7);
      const updated = CardStore.addLocationGeohash(currentCard.id, geohash);
      currentCard   = updated || currentCard;

      label.textContent = '✓ Saved!';
      btn.classList.add('btn--success');
      toast(`Location saved (Geohash: ${geohash}) 📍`);

      setTimeout(() => {
        btn.disabled          = false;
        label.textContent     = '📍 Used here';
        btn.classList.remove('btn--success');
        renderLocationHistory(currentCard);
        document.getElementById('location-accuracy').textContent =
          `Current area: ${geohash} · Matching checks exact cell & 8 adjacent neighbors`;
      }, 2000);
    } catch (err) {
      btn.disabled      = false;
      label.textContent = '📍 Used here';
      toast('⚠️ Couldn\'t get location — check permissions');
    }
  }

  // ── Share Card Link ───────────────────────────────────────────

  function getCardShareUrl(card) {
    const cardData = {
      name: card.name,
      data: card.data,
      emoji: card.emoji || '💳',
      color: card.color || '#6c63ff',
      locations: card.locations || []
    };
    const jsurlStr = JSURL.stringify(cardData);
    const baseUrl = location.origin + location.pathname;
    return `${baseUrl}#card=${jsurlStr}`;
  }

  async function shareCard() {
    if (!currentCard) return;
    const shareUrl = getCardShareUrl(currentCard);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentCard.emoji || '💳'} ${currentCard.name}`,
          text: `Card for ${currentCard.name}`,
          url: shareUrl
        });
        toast('✓ Shared card successfully!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast('✓ Card share link copied to clipboard!');
    } catch (_) {
      const input = document.createElement('textarea');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      toast('✓ Card share link copied to clipboard!');
    }
  }

  // ── URL Import on Arrival ─────────────────────────────────────

  function checkUrlForCardImport() {
    let jsurlStr = null;

    const hash = location.hash;
    if (hash) {
      if (hash.startsWith('#card=')) {
        jsurlStr = hash.slice(6);
      } else if (hash.startsWith('#~')) {
        jsurlStr = hash.slice(1);
      }
    }

    if (!jsurlStr) {
      const params = new URLSearchParams(location.search);
      if (params.has('card')) {
        jsurlStr = params.get('card');
      }
    }

    if (!jsurlStr) return false;

    try {
      const cardData = JSURL.parse(jsurlStr);
      if (cardData && typeof cardData === 'object' && cardData.name && cardData.data) {
        history.replaceState(null, '', location.pathname);

        let locs = [];
        if (Array.isArray(cardData.locations)) {
          locs = cardData.locations
            .map(l => String(l).slice(0, 7))
            .filter(l => l.length === 7);
        }

        const newCard = CardStore.add({
          name: String(cardData.name),
          data: String(cardData.data),
          emoji: cardData.emoji ? String(cardData.emoji) : '💳',
          color: cardData.color ? String(cardData.color) : '#6c63ff',
          locations: locs
        });

        if (newCard.isMerged) {
          toast(`✓ Merged location data for ${newCard.emoji} ${newCard.name}`);
        } else {
          toast(`✓ Added ${newCard.emoji} ${newCard.name} to your wallet!`);
        }
        openCard(newCard.id);
        return true;
      }
    } catch (err) {
      console.error('Failed to parse card from URL:', err);
    }
    return false;
  }

  // ── Add Card Screen ───────────────────────────────────────────

  function initAddForm() {
    const dataInput  = document.getElementById('card-data');
    const colorInput = document.getElementById('card-color');
    const preview    = document.getElementById('qr-preview');
    const hint       = document.getElementById('qr-hint');

    let previewFormat = 'qr';

    function updatePreview() {
      const val = dataInput.value.trim();
      const items = parseCardData(val);
      if (items.length) {
        hint.textContent = items.length > 1
          ? `✨ ${items.length} codes entered (tap preview to switch format: QR / Barcode)`
          : 'Tap preview to switch format (QR / Barcode)';
        const code = items[0];
        if (previewFormat === 'barcode') {
          preview.className = 'qr-preview-box format-barcode';
          Barcode.render(preview, code);
        } else {
          preview.className = 'qr-preview-box format-qr';
          QR.render(preview, code);
        }
      } else {
        preview.innerHTML = '';
        preview.className = 'qr-preview-box';
        hint.textContent  = 'Enter card data above to preview';
      }
    }

    dataInput.addEventListener('input', updatePreview);
    preview.style.cursor = 'pointer';
    preview.title = 'Tap preview to switch format (QR / Barcode)';
    preview.addEventListener('click', () => {
      previewFormat = previewFormat === 'qr' ? 'barcode' : 'qr';
      updatePreview();
      toast(`Preview format: ${previewFormat === 'barcode' ? 'Barcode ║▌║' : 'QR Code 🔳'}`);
    });

    const scanBtn = document.getElementById('scan-btn');

    if (!navigator.mediaDevices?.getUserMedia) {
      scanBtn.style.display = 'none';
    } else {
      scanBtn.addEventListener('click', async () => {
        try {
          const scanned = await Scanner.open();
          if (dataInput.value.trim()) {
            dataInput.value = dataInput.value.trim() + '\n' + scanned;
          } else {
            dataInput.value = scanned;
          }
          dataInput.dispatchEvent(new Event('input'));
          const count = parseCardData(dataInput.value).length;
          toast(`✓ Scanned code! (${count} code${count !== 1 ? 's' : ''} total)`);
        } catch (err) {
          if (err.message === 'cancelled') return;
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

    document.querySelectorAll('.swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        colorInput.value = btn.dataset.color;
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    const first = document.querySelector('.swatch');
    if (first) first.classList.add('active');

    colorInput.addEventListener('input', () => {
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    });

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

      if (editingCardId) {
        const updated = CardStore.update(editingCardId, { name, data, emoji, color });
        resetAddForm();
        if (updated) {
          openCard(updated.id);
          toast(`✓ ${emoji} ${name} updated`);
        } else {
          showScreen('home', 'back');
          renderHome();
        }
      } else {
        const savedCard = CardStore.add({ name, data, emoji, color });
        resetAddForm();
        showScreen('home', 'back');
        renderHome();
        if (savedCard.isMerged) {
          toast(`✓ Merged location data for ${emoji} ${name}`);
        } else {
          toast(`✓ ${emoji} ${name} added to your wallet`);
        }
      }
    });
  }

  function resetAddForm() {
    editingCardId = null;
    const form = document.getElementById('add-form');
    if (form) form.reset();
    const emojiInput = document.getElementById('card-emoji');
    if (emojiInput) emojiInput.value = '💳';

    const title = document.getElementById('add-screen-title');
    if (title) title.textContent = 'New card';
    const submitBtn = document.getElementById('add-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Save card';

    const colorInput = document.getElementById('card-color');
    if (colorInput) colorInput.value = '#6c63ff';

    document.querySelectorAll('.swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === '#6c63ff');
    });

    const preview = document.getElementById('qr-preview');
    const hint = document.getElementById('qr-hint');
    if (preview) preview.innerHTML = '';
    if (hint) hint.textContent = 'Enter card data above to preview';
  }

  function openEditCard(card) {
    if (!card) return;
    editingCardId = card.id;

    const title = document.getElementById('add-screen-title');
    if (title) title.textContent = 'Edit card';
    const submitBtn = document.getElementById('add-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Update card';

    document.getElementById('card-emoji').value = card.emoji || '💳';
    document.getElementById('card-name').value = card.name || '';

    const items = parseCardData(card.data);
    document.getElementById('card-data').value = items.join('\n');

    const color = card.color || '#6c63ff';
    const colorInput = document.getElementById('card-color');
    if (colorInput) colorInput.value = color;

    document.querySelectorAll('.swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === color);
    });

    const dataInput = document.getElementById('card-data');
    if (dataInput) dataInput.dispatchEvent(new Event('input'));

    showScreen('add');
  }

  // ── Event Binding ─────────────────────────────────────────────

  function bindGlobalEvents() {
    document.getElementById('add-btn').addEventListener('click', () => {
      resetAddForm();
      showScreen('add');
    });

    const toggleFormatBtn = document.getElementById('toggle-format-btn');
    if (toggleFormatBtn) {
      toggleFormatBtn.addEventListener('click', toggleCodeFormat);
    }

    const detailQr = document.getElementById('detail-qr');
    if (detailQr) {
      detailQr.addEventListener('click', toggleCodeFormat);
      detailQr.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCodeFormat();
        }
      });
    }

    const editBtn = document.getElementById('detail-edit-top');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (currentCard) openEditCard(currentCard);
      });
    }

    const shuffleBtn = document.getElementById('shuffle-code-btn');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', () => {
        if (!currentCard) return;
        const items = parseCardData(currentCard.data);
        if (items.length <= 1) return;
        let nextIndex = Math.floor(Math.random() * items.length);
        if (nextIndex === activeDataIndex && items.length > 1) {
          nextIndex = (activeDataIndex + 1) % items.length;
        }
        renderCardCode(currentCard, nextIndex);
        toast(`🎲 Switched to code ${nextIndex + 1} of ${items.length}`);
      });
    }

    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (editingCardId && currentCard) {
          editingCardId = null;
          showScreen('detail', 'back');
        } else {
          editingCardId = null;
          showScreen('home', 'back');
          renderHome();
        }
      });
    });

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

    document.getElementById('use-here-btn').addEventListener('click', useHere);

    const shareBtn = document.getElementById('share-card-btn');
    if (shareBtn) shareBtn.addEventListener('click', shareCard);
    const topShareBtn = document.getElementById('detail-share-top');
    if (topShareBtn) topShareBtn.addEventListener('click', shareCard);

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        toast('🔄 Reloading app…');
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) await reg.update();
          } catch (_) {}
        }
        setTimeout(() => location.reload(true), 150);
      });
    }
  }

  // ── Public init ───────────────────────────────────────────────

  return {
    init() {
      bindGlobalEvents();
      initAddForm();
      const imported = checkUrlForCardImport();
      if (!imported) {
        renderHome();
      }
    }
  };
})();

// Export components globally
window.JSURL = JSURL;
window.Geohash = Geohash;
window.CardStore = CardStore;
window.Location = Location;
window.Barcode = Barcode;
window.App = App;

window.addEventListener('error', (e) => {
  console.error('Global error caught:', e.error || e.message);
  const status = document.getElementById('location-status');
  if (status && !status.textContent) {
    status.textContent = '⚠️ Error occurred — tap 🔄';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  try {
    App.init();
  } catch (err) {
    console.error('Failed to initialize Magic Wallet:', err);
    try {
      const cardsList = document.getElementById('cards-list');
      if (cardsList) {
        cardsList.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">Unable to initialize wallet. Tap 🔄 above to reload.</p>';
      }
    } catch (_) {}
  }
});

// Register Service Worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('ServiceWorker registered:', reg.scope))
      .catch(err => console.error('ServiceWorker registration failed:', err));
  });
}
