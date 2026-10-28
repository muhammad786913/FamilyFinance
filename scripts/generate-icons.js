/**
 * Generates local PNG icons for the installable web app (no network, no image deps).
 * Run: node scripts/generate-icons.js
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function hex(value) {
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
}

function drawIcon(size, { radius = 0.22, fullBleed = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const [br, bg, bb] = hex("#00A6D6");
  const r = fullBleed ? 0 : size * radius;
  const set = (x, y, cr, cg, cb, ca = 255) => {
    const i = (y * size + x) * 4;
    px[i] = cr;
    px[i + 1] = cg;
    px[i + 2] = cb;
    px[i + 3] = ca;
  };
  const insideRounded = (x, y) => {
    if (r === 0) return true;
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  const u = size / 64;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!insideRounded(x, y)) {
        set(x, y, 0, 0, 0, 0);
        continue;
      }
      set(x, y, br, bg, bb, 255);
    }
  }
  // White roof (triangle) and walls.
  const roofTop = 14 * u;
  const roofBottom = 30 * u;
  const left = 14 * u;
  const right = 50 * u;
  for (let y = Math.floor(roofTop); y < Math.ceil(roofBottom); y += 1) {
    const t = (y - roofTop) / (roofBottom - roofTop);
    const half = (t * (right - left)) / 2 + 2 * u;
    const mid = size / 2;
    for (let x = Math.floor(mid - half); x < Math.ceil(mid + half); x += 1) {
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, 255, 255, 255, 255);
    }
  }
  const wallTop = Math.floor(roofBottom - 1 * u);
  const wallBottom = Math.ceil(50 * u);
  const wallLeft = Math.floor(20 * u);
  const wallRight = Math.ceil(44 * u);
  for (let y = wallTop; y < wallBottom; y += 1) {
    for (let x = wallLeft; x < wallRight; x += 1) set(x, y, 255, 255, 255, 255);
  }
  // Door cut-out in brand colour.
  const doorLeft = Math.floor(29 * u);
  const doorRight = Math.ceil(35 * u);
  const doorTop = Math.floor(41 * u);
  for (let y = doorTop; y < wallBottom; y += 1) {
    for (let x = doorLeft; x < doorRight; x += 1) set(x, y, br, bg, bb, 255);
  }
  return png(size, size, px);
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
const files = [
  ["icon-192.png", drawIcon(192)],
  ["icon-512.png", drawIcon(512)],
  ["icon-maskable-512.png", drawIcon(512, { fullBleed: true })],
  ["apple-touch-icon.png", drawIcon(180, { radius: 0.2 })],
  ["favicon-32.png", drawIcon(32, { radius: 0.18 })],
];
for (const [name, buffer] of files) {
  fs.writeFileSync(path.join(outDir, name), buffer);
  console.log("wrote", name, buffer.length, "bytes");
}
