/**
 * scripts/vite-build-once.mjs
 *
 * Builds the @covas/codex-widget workspace into a self-contained dist/
 * directory on first run, then skips the build when the source hash
 * hasn't changed.
 *
 * Usage:
 *   node scripts/vite-build-once.mjs [--root <monorepo-root>]
 *
 * Env:
 *   COVAS_WIDGET_BUILD=1   Set by start-mcp.mjs so the build is trusted.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv.includes('--root')
  ? process.argv[process.argv.indexOf('--root') + 1]
  : path.resolve(__dirname, '..'));

const WIDGET_DIR = path.join(ROOT, 'apps', 'codex-widget');
const DIST_DIR = path.join(WIDGET_DIR, 'dist');
const MARKER_FILE = path.join(DIST_DIR, '.covas-widget-build.json');

const BUILD_INPUT_FILES = [
  path.join(ROOT, 'package.json'),
  path.join(ROOT, 'package-lock.json'),
  path.join(ROOT, 'tsconfig.base.json'),
  path.join(WIDGET_DIR, 'package.json'),
  path.join(WIDGET_DIR, 'vite.config.ts'),
  path.join(WIDGET_DIR, 'index.html'),
  path.join(WIDGET_DIR, 'src'),
];

// ─── Hash ──────────────────────────────────────────────────────────────────

async function buildSourceHash() {
  const hash = createHash('sha256');

  for (const input of BUILD_INPUT_FILES) {
    try {
      const stat = statSync(input);
      if (stat.isDirectory()) {
        const files = await listFiles(input);
        for (const f of files.sort()) {
          hash.update(path.relative(ROOT, f));
          hash.update(await readFile(f));
        }
      } else {
        hash.update(path.relative(ROOT, input));
        hash.update(await readFile(input));
      }
    } catch {
      // File doesn't exist yet — include nothing for that slot.
    }
  }

  return hash.digest('hex');
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

// ─── Build ──────────────────────────────────────────────────────────────────

async function runViteBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npm',
      ['run', 'build', '--workspace', '@covas/codex-widget'],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          BROWSER: 'none',
          FORCE_COLOR: '0',
          COVAS_WIDGET_BUILD: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    const logs = [];
    const capture = (chunk) => {
      logs.push(String(chunk));
      if (logs.length > 200) logs.shift();
    };
    child.stdout?.on('data', capture);
    child.stderr?.on('data', capture);

    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`vite build failed (${signal ?? `code ${code}`}).\n${logs.join('')}`));
      }
    });
  });
}

function readMarker() {
  try {
    return JSON.parse(readFileSync(MARKER_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function writeMarker(hash) {
  mkdirSync(DIST_DIR, { recursive: true });
  await writeFile(MARKER_FILE, JSON.stringify({ sourceHash: hash }, null, 2) + '\n');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.COVAS_WIDGET_BUILD) {
    console.warn('[covas] vite-build-once.mjs: COVAS_WIDGET_BUILD is not set — build may be untrusted.');
  }

  const marker = readMarker();
  if (marker) {
    const currentHash = await buildSourceHash();
    if (currentHash === marker.sourceHash) {
      // Up to date — no need to rebuild.
      return;
    }
  }

  console.log('[covas] Building @covas/codex-widget widget...');
  await runViteBuild();
  const hash = await buildSourceHash();
  await writeMarker(hash);
  console.log('[covas] Widget build complete.');
}

main().catch((err) => {
  console.error('[covas]', err.message);
  process.exit(1);
});
