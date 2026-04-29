import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(process.cwd());
const outDir = join(root, 'public', 'assets', 'icons');
const catFrame = join(root, 'public', 'assets', 'cheeto', 'animations', 'calm_idle', 'south', 'frame_000.png');

// For each size: how large (px) the cat occupies inside the icon.
// Keeps generous padding at small sizes so the cat reads clearly.
const sizes = [
  { size: 16,  catPx: 13 },
  { size: 32,  catPx: 26 },
  { size: 48,  catPx: 38 },
  { size: 128, catPx: 100 },
];

/** Warm rounded-corner background as SVG buffer. */
function bgSvg(size) {
  const r = Math.round(size * 0.22);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#FFF8F0"/>
    </svg>`,
    'utf8',
  );
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  await Promise.all(
    sizes.map(async ({ size, catPx }) => {
      const outPath = join(outDir, `icon${size}.png`);

      // Scale cat frame with nearest-neighbor to keep pixel art crisp.
      const catBuf = await sharp(catFrame)
        .resize(catPx, catPx, { kernel: 'nearest', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      // Center the cat on the background.
      const offset = Math.round((size - catPx) / 2);

      await sharp(bgSvg(size))
        .resize(size, size)
        .composite([{ input: catBuf, top: offset, left: offset }])
        .png()
        .toFile(outPath);
    }),
  );

  console.log('[icons] generated icon16/32/48/128.png from cat sprite');
}

await main();
