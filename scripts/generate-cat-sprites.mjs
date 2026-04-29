/**
 * Builds the runtime sprite sheets the content script consumes.
 *
 * Source: `public/assets/cheeto/animations/<animation>/<direction>/frame_*.png`
 *         (8-direction top-down character; folder names match what the artist exports).
 * Output: horizontal strips written next to the animations folder, named by the
 *         keys the runtime expects (see TARGETS below).
 *
 * Missing source folders fall back to a marker placeholder so the build never
 * breaks; the report logs which sheets are real vs. placeholder.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(process.cwd());
const CHARACTER_DIR = join(ROOT, 'public', 'assets', 'cheeto');
const META_PATH = join(CHARACTER_DIR, 'metadata.json');
const FRAME_SIZE_DEFAULT = 92;

/**
 * Each target produces one horizontal sprite sheet.
 * `src` is a folder under CHARACTER_DIR; the script reads frame_*.png from it.
 * `frames` is the desired sheet length (frames are cycled if source has fewer).
 * `singleFrameSrc` is for static rotations (1×1 sheets).
 */
const TARGETS = [
  // 8-direction walking (top-down — every direction is a unique pose, no flipping)
  { out: 'walk_north.png',     src: 'animations/nort_run/north',                              frames: 6 },
  { out: 'walk_south.png',     src: 'animations/south_run/south',                             frames: 6 },
  { out: 'walk_east.png',      src: 'animations/east_west_improved-c396ae5a/east',            frames: 10 },
  { out: 'walk_west.png',      src: 'animations/east_west_improved-c396ae5a/west',            frames: 10 },
  { out: 'walk_north_east.png', src: 'animations/north-east_nort-west_run/north-east',         frames: 6 },
  { out: 'walk_north_west.png', src: 'animations/north-east_nort-west_run/north-west',         frames: 6 },
  { out: 'walk_south_east.png', src: 'animations/south_east_south_west_run/south-east',        frames: 6 },
  { out: 'walk_south_west.png', src: 'animations/south_east_south_west_run/south-west',        frames: 6 },

  // Two idle moods. Controller picks one per Idle entry (see PetController.idleVariant).
  { out: 'idle_calm.png',      src: 'animations/calm_idle/south',                             frames: 6 },
  { out: 'idle_exciting.png',  src: 'animations/exciting_idle/south',                         frames: 6 },

  // Eat plays only from the south pose (food drops below the cat). Cat orients
  // south on REACHED_FOOD before this animation starts.
  { out: 'eat_south.png',      src: 'animations/eat_animation/south',                         frames: 6 },

  // Sleep intro — plays once when the cat first falls asleep (8 frames).
  { out: 'sleep.png',          src: 'animations/sleep/south',                                 frames: 8 },
  // Sleep loop — plays after the intro, loops indefinitely (16 frames).
  { out: 'sleep_loop.png',     src: 'animations/long_sleep/south',                            frames: 16 },

  // Sit idle loop — cat sits after prolonged Idle.
  { out: 'sit.png',            src: 'animations/sit_edle-6d2da643/south',                     frames: 8 },

  // One-shot transition from walking/idle into the sit pose.
  { out: 'sit_transition.png', src: 'animations/transitionfrom_wlaking_to_sitting-cc510984/south', frames: 9 },

  // One-shot happy reaction played on left-click.
  { out: 'react_happy.png',    src: 'animations/happy_excited-25c64105/south',                frames: 9 },

  // Play animation — triggered by right-click "Play" action (16 frames, loops for ~2.4s).
  { out: 'cat_playing.png',    src: 'animations/cat_playing/south',                           frames: 16 },

  // Static fish food sprite — rendered as a single-frame sheet.
  { out: 'fish.png',           singleFrameSrc: 'animations/fish.png',                         frames: 1 },

  // Static fallback shown when an animation slot has no source (e.g. before
  // a new pose is exported). Resolves through animations.ts FALLBACK.
  { out: 'base.png',           singleFrameSrc: 'rotations/south.png',                         frames: 1 },
];

function readMetadata() {
  if (!existsSync(META_PATH)) return null;
  try {
    return JSON.parse(readFileSync(META_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function readFolderFrames(absDir) {
  if (!existsSync(absDir)) return [];
  return readdirSync(absDir)
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => join(absDir, name));
}

function cycleToLength(items, targetLength) {
  if (items.length === 0) return [];
  const out = [];
  for (let i = 0; i < targetLength; i += 1) {
    out.push(items[i % items.length]);
  }
  return out;
}

async function loadFrameBuffer(filePath, frameSize) {
  return sharp(filePath).resize(frameSize, frameSize, { fit: 'contain' }).png().toBuffer();
}

async function buildSheet(framePaths, frameSize, frameCount) {
  const normalized = cycleToLength(framePaths, frameCount);
  const frameBuffers = await Promise.all(
    normalized.map((p) => loadFrameBuffer(p, frameSize)),
  );
  const composites = frameBuffers.map((input, idx) => ({
    input,
    left: idx * frameSize,
    top: 0,
  }));
  return sharp({
    create: {
      width: frameSize * frameCount,
      height: frameSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

function placeholderSvg(name, frameSize) {
  const label = name.replace('.png', '').slice(0, 12);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${frameSize}" height="${frameSize}">
      <rect width="100%" height="100%" fill="#ffe7cf"/>
      <circle cx="${frameSize / 2}" cy="${frameSize / 2}" r="${frameSize * 0.3}" fill="#f4a261"/>
      <text x="50%" y="88%" font-size="9" text-anchor="middle" fill="#2a2520">${label}</text>
    </svg>`,
    'utf8',
  );
}

async function buildPlaceholderSheet(fileName, frameSize, frameCount) {
  const baseFrame = await sharp(placeholderSvg(fileName, frameSize)).png().toBuffer();
  const composites = Array.from({ length: frameCount }, (_, idx) => ({
    input: baseFrame,
    left: idx * frameSize,
    top: 0,
  }));
  return sharp({
    create: {
      width: frameSize * frameCount,
      height: frameSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function resolveFramePaths(target) {
  if (target.singleFrameSrc) {
    const abs = join(CHARACTER_DIR, target.singleFrameSrc);
    return existsSync(abs) ? [abs] : [];
  }
  return readFolderFrames(join(CHARACTER_DIR, target.src));
}

async function main() {
  if (!existsSync(CHARACTER_DIR)) {
    throw new Error(`[sprites] character folder missing: ${CHARACTER_DIR}`);
  }

  const meta = readMetadata();
  const frameSize = Number(meta?.character?.size?.width ?? FRAME_SIZE_DEFAULT);
  const report = [];

  for (const target of TARGETS) {
    const framePaths = await resolveFramePaths(target);
    const outputPath = join(CHARACTER_DIR, target.out);
    mkdirSync(dirname(outputPath), { recursive: true });

    const sheetBuffer =
      framePaths.length > 0
        ? await buildSheet(framePaths, frameSize, target.frames)
        : await buildPlaceholderSheet(target.out, frameSize, target.frames);

    writeFileSync(outputPath, sheetBuffer);
    report.push({
      file: target.out,
      frameCount: target.frames,
      sourceFrames: framePaths.length,
      mode: framePaths.length > 0 ? 'from-source' : 'placeholder',
    });
  }

  const reportPath = join(CHARACTER_DIR, 'generated-report.json');
  writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2));
  const placeholderCount = report.filter((r) => r.mode === 'placeholder').length;
  const sourceCount = report.length - placeholderCount;
  console.log(`[sprites] generated ${report.length} sheets for cheeto (${sourceCount} source, ${placeholderCount} placeholder)`);
  if (placeholderCount > 0) {
    const missing = report.filter((r) => r.mode === 'placeholder').map((r) => r.file).join(', ');
    console.log(`[sprites] placeholder targets (no source frames found): ${missing}`);
  }
}

await main();
