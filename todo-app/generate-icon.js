const zlib = require('zlib');
const fs = require('fs');

// CRC32
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const t = Buffer.from(type, 'ascii');
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])));
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  return Buffer.concat([len, t, data, crcVal]);
}

function makePNG(size, pixels) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size*4+1) + 1, y*size*4, (y+1)*size*4);
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND')]);
}

function makeICO(pngBufs, sizes) {
  const n = pngBufs.length;
  const hdrSize = 6 + n * 16;
  const offsets = [];
  let off = hdrSize;
  for (const p of pngBufs) { offsets.push(off); off += p.length; }
  const hdr = Buffer.alloc(hdrSize);
  hdr.writeUInt16LE(0, 0); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(n, 4);
  for (let i = 0; i < n; i++) {
    const b = 6 + i * 16, s = sizes[i];
    hdr[b] = s >= 256 ? 0 : s; hdr[b+1] = s >= 256 ? 0 : s;
    hdr[b+2] = 0; hdr[b+3] = 0;
    hdr.writeUInt16LE(1, b+4); hdr.writeUInt16LE(32, b+6);
    hdr.writeUInt32LE(pngBufs[i].length, b+8);
    hdr.writeUInt32LE(offsets[i], b+12);
  }
  return Buffer.concat([hdr, ...pngBufs]);
}

function setPixel(buf, size, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 4;
  buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
}

function drawLine(buf, size, x0, y0, x1, y1, r, g, b, thick) {
  const dx = Math.abs(x1-x0), sx = x0<x1?1:-1;
  const dy = -Math.abs(y1-y0), sy = y0<y1?1:-1;
  let err = dx+dy, x = x0, y = y0;
  while (true) {
    for (let tx = -thick; tx <= thick; tx++)
      for (let ty = -thick; ty <= thick; ty++)
        if (tx*tx + ty*ty <= thick*thick*1.5)
          setPixel(buf, size, x+tx, y+ty, r, g, b);
    if (x===x1 && y===y1) break;
    const e2 = 2*err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function createImage(size) {
  const buf = Buffer.alloc(size * size * 4, 0);

  // Rounded rect background — purple #a78bfa on transparent
  const pad = Math.max(1, Math.round(size * 0.04));
  const rad = Math.round(size * 0.22);
  const x0 = pad, y0 = pad, x1 = size-1-pad, y1 = size-1-pad;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
      if (inside) {
        if      (x < x0+rad && y < y0+rad) inside = (x-(x0+rad))**2+(y-(y0+rad))**2 <= rad*rad;
        else if (x > x1-rad && y < y0+rad) inside = (x-(x1-rad))**2+(y-(y0+rad))**2 <= rad*rad;
        else if (x < x0+rad && y > y1-rad) inside = (x-(x0+rad))**2+(y-(y1-rad))**2 <= rad*rad;
        else if (x > x1-rad && y > y1-rad) inside = (x-(x1-rad))**2+(y-(y1-rad))**2 <= rad*rad;
      }
      if (inside) setPixel(buf, size, x, y, 0xa7, 0x8b, 0xfa);
    }
  }

  // White checkmark
  const t = Math.max(1, Math.round(size * 0.08));
  const ax = Math.round(size * 0.21), ay = Math.round(size * 0.52);
  const bx = Math.round(size * 0.42), by = Math.round(size * 0.73);
  const cx = Math.round(size * 0.79), cy = Math.round(size * 0.27);

  drawLine(buf, size, ax, ay, bx, by, 255, 255, 255, t);
  drawLine(buf, size, bx, by, cx, cy, 255, 255, 255, t);

  return buf;
}

const SIZES = [16, 32, 48, 256];
const pngs = SIZES.map(s => makePNG(s, createImage(s)));
fs.writeFileSync('icon.ico', makeICO(pngs, SIZES));
console.log('icon.ico created');
