/**
 * PWA icon generator: draws the title sigil as pixel art and writes
 * PNGs with a tiny zero-dependency encoder (zlib + hand-rolled CRC).
 * Run via `npm run genicons`; outputs land in content/icons/ (served
 * from the app root through Vite's publicDir).
 *
 * Design: a gold four-pointed star on the night palette, sized well
 * inside the maskable safe zone.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(import.meta.dirname, '..', 'content', 'icons');

/* ---------- palette (src/data/constants.ts PALETTE) ---------- */
const BG = [0x16, 0x11, 0x2b, 255] as const; // ink
const RING = [0x2e, 0x25, 0x54, 255] as const; // night2
const GOLD = [0xff, 0xc8, 0x57, 255] as const;
const GOLD_DIM = [0xa8, 0x7f, 0x2f, 255] as const;

type Rgba = readonly [number, number, number, number];

/** The 16x16 design grid: '.' bg, 'r' ring, 'g' gold, 'd' dim gold. */
const DESIGN: readonly string[] = [
  '................',
  '.......gg.......',
  '.......gg.......',
  '......dggd......',
  '...r..dggd..r...',
  '..r....gg....r..',
  '.r.....gg.....r.',
  '.ggddgggggggddgg',
  '.ggddgggggggddgg',
  '.r.....gg.....r.',
  '..r....gg....r..',
  '...r..dggd..r...',
  '......dggd......',
  '.......gg.......',
  '.......gg.......',
  '................',
];

const COLORS: Record<string, Rgba> = { '.': BG, r: RING, g: GOLD, d: GOLD_DIM };

/* ---------- minimal PNG encoder ---------- */

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size: number, pixelAt: (x: number, y: number) => Rgba): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      const o = row + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function writeIcon(size: number): void {
  const cell = size / DESIGN.length;
  const png = encodePng(size, (x, y) => {
    const gx = Math.min(DESIGN.length - 1, Math.floor(x / cell));
    const gy = Math.min(DESIGN.length - 1, Math.floor(y / cell));
    const ch = DESIGN[gy]?.[gx] ?? '.';
    return COLORS[ch] ?? BG;
  });
  const file = join(OUT_DIR, `icon-${String(size)}.png`);
  writeFileSync(file, png);
  console.log(`genicons: wrote ${file} (${String(png.length)} bytes)`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeIcon(192);
writeIcon(512);
