import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, r, g, b) {
  // 8-byte PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: 13 bytes data
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(2, 9); // Color type 2: RGB
  ihdrData.writeUInt8(0, 10); // Compression method 0
  ihdrData.writeUInt8(0, 11); // Filter method 0
  ihdrData.writeUInt8(0, 12); // Interlace method 0
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image scanlines: each line starts with filter byte 0
  const rowBytes = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowBytes);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.45;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter type None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      // Industrial rounded badge design
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check pallet horizontal slats
      const inPalletX = x >= width * 0.18 && x <= width * 0.82;
      const isSlat1 = inPalletX && y >= height * 0.32 && y <= height * 0.38;
      const isSlat2 = inPalletX && y >= height * 0.42 && y <= height * 0.48;
      const isSlat3 = inPalletX && y >= height * 0.52 && y <= height * 0.58;
      const isFoot = inPalletX && y >= height * 0.58 && y <= height * 0.68 &&
        ((x >= width * 0.22 && x <= width * 0.34) ||
         (x >= width * 0.44 && x <= width * 0.56) ||
         (x >= width * 0.66 && x <= width * 0.78));
      const isBase = inPalletX && y >= height * 0.68 && y <= height * 0.72;

      if (dist < radius) {
        if (isSlat1 || isSlat2 || isSlat3 || isFoot || isBase) {
          // Emerald accent
          rawData[pxOffset] = 16;
          rawData[pxOffset + 1] = 185;
          rawData[pxOffset + 2] = 129;
        } else {
          // Deep Forest Green
          rawData[pxOffset] = r;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
        }
      } else {
        // Outer background
        rawData[pxOffset] = 4;
        rawData[pxOffset + 1] = 47;
        rawData[pxOffset + 2] = 46;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c = c ^ buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
    }
  }
  return ~c;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeInt32BE(crc, 8 + len);
  return chunk;
}

const outDir = path.resolve('public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Generate all standard PWA resolutions
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), createPng(192, 192, 6, 78, 59));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), createPng(512, 512, 6, 78, 59));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), createPng(512, 512, 6, 78, 59));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), createPng(180, 180, 6, 78, 59));
console.log('PWA icons created successfully in public/');
