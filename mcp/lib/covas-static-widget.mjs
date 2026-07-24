/**
 * mcp/lib/covas-static-widget.mjs
 *
 * Builds the Covas widget on first invocation and returns its contents
 * as a CSP-compatible inlined HTML string.
 *
 * The build is cached in a temp directory keyed by the plugin version.
 * When the source hash changes, the build is re-run.
 *
 * For Codex, the resulting HTML is registered as a Resource via
 * registerAppResource (from @modelcontextprotocol/ext-apps), keyed as:
 *   ui://widget/covas/workspace.html
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { pluginPath, pluginRoot } from './plugin-root.mjs';

// ─── Version ────────────────────────────────────────────────────────────────

const PLUGIN_MANIFEST = JSON.parse(
  existsSync(pluginPath('.codex-plugin', 'plugin.json'))
    ? await readFile(pluginPath('.codex-plugin', 'plugin.json'), 'utf8')
    : '{}',
);

const PLUGIN_VERSION = PLUGIN_MANIFEST.version ?? '0.1.0';

export const COVAS_STATIC_BUILD_DIR =
  process.env.COVAS_WIDGET_STATIC_DIR ??
  path.join(tmpdir(), `covas-widget-build-v${PLUGIN_VERSION}`);

const BUILD_MARKER_FILE = '.covas-widget-build.json';

// ─── Cached HTML ────────────────────────────────────────────────────────────

let cachedStaticHtml = '';
let pendingStaticHtml = null;

export async function covasStaticHtml() {
  if (cachedStaticHtml) return cachedStaticHtml;

  pendingStaticHtml ??= buildCovasStaticHtml().finally(() => {
    pendingStaticHtml = null;
  });

  cachedStaticHtml = await pendingStaticHtml;
  return cachedStaticHtml;
}

async function buildCovasStaticHtml() {
  await ensureViteBinary();
  await ensureStaticBuildDir();
  return inlineViteBuild(COVAS_STATIC_BUILD_DIR);
}

// ─── Build directory management ─────────────────────────────────────────────

async function ensureStaticBuildDir() {
  const sourceHash = await buildSourceHash();

  if (existsSync(path.join(COVAS_STATIC_BUILD_DIR, 'index.html'))) {
    const marker = await readBuildMarker();
    if (marker?.sourceHash === sourceHash) return;
  }

  await runViteBuild();
  await writeBuildMarker(sourceHash);
}

async function runViteBuild() {
  return new Promise((resolve, reject) => {
    const logs = [];

    const child = spawn(
      process.execPath,
      [pluginPath('scripts', 'vite-build-once.mjs'), '--root', pluginRoot()],
      {
        cwd: pluginRoot(),
        env: {
          ...process.env,
          BROWSER: 'none',
          FORCE_COLOR: '0',
          COVAS_WIDGET_BUILD: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    const capture = (chunk) => {
      logs.push(String(chunk));
      if (logs.length > 200) logs.shift();
    };
    child.stdout?.on('data', capture);
    child.stderr?.on('data', capture);

    child.on('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(
          `Vite build failed for Covas widget (${signal ?? `code ${code}`}).\n${logs.join('')}`,
        ));
      }
    });
  });
}

// ─── Vite binary presence check ─────────────────────────────────────────────

function viteBinaryPath() {
  return pluginPath(
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'vite.cmd' : 'vite',
  );
}

async function ensureViteBinary() {
  if (existsSync(viteBinaryPath())) return;

  await runNpmInstall();

  if (!existsSync(viteBinaryPath())) {
    throw new Error(
      'Missing Vite after npm install in the Covas plugin directory.',
    );
  }
}

function runNpmInstall() {
  return new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm', 'install']
      : ['install'];

    const child = spawn(command, args, {
      cwd: pluginRoot(),
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.on('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install failed (${signal ?? `code ${code}`}).`));
    });
  });
}

// ─── Hash ───────────────────────────────────────────────────────────────────

async function buildSourceHash() {
  const hash = createHash('sha256');
  hash.update(PLUGIN_VERSION);

  const files = [
    pluginPath('.codex-plugin', 'plugin.json'),
    pluginPath('apps', 'codex-widget', 'package.json'),
    pluginPath('apps', 'codex-widget', 'vite.config.ts'),
    pluginPath('apps', 'codex-widget', 'index.html'),
    pluginPath('apps', 'codex-widget', 'src'),
  ];

  const sorted = (await collectFiles(files)).sort();

  for (const file of sorted) {
    hash.update(path.relative(pluginRoot(), file));
    hash.update(await readFile(file));
  }

  return hash.digest('hex');
}

async function collectFiles(roots) {
  const files = [];
  for (const root of roots) {
    try {
      const stat = statMaybe(root);
      if (!stat) continue;
      if (stat.isDirectory()) {
        files.push(...(await listDirFiles(root)));
      } else {
        files.push(root);
      }
    } catch {
      // ignore
    }
  }
  return files;
}

async function listDirFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listDirFiles(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function statMaybe(p) {
  try { return statSync(p); } catch { return null; }
}

// ─── Marker ─────────────────────────────────────────────────────────────────

async function readBuildMarker() {
  try {
    return JSON.parse(
      await readFile(path.join(COVAS_STATIC_BUILD_DIR, BUILD_MARKER_FILE), 'utf8'),
    );
  } catch {
    return null;
  }
}

async function writeBuildMarker(hash) {
  await writeFile(
    path.join(COVAS_STATIC_BUILD_DIR, BUILD_MARKER_FILE),
    JSON.stringify({ sourceHash: hash }, null, 2) + '\n',
  );
}

// ─── HTML inlining ───────────────────────────────────────────────────────────

async function inlineViteBuild(outDir) {
  let html = await readFile(path.join(outDir, 'index.html'), 'utf8');
  const inlineScripts = [];
  const consumedAssets = new Set();

  // Strip modulepreload links — not needed for inlined builds.
  html = html.replace(
    /<link\s+rel="modulepreload"[^>]+href="([^"]+)"[^>]*>\s*/gi,
    '',
  );

  // Inline stylesheets.
  html = await replaceAsync(
    html,
    /<link\s+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/gi,
    async (match, href) => {
      const css = await readBuildAsset(outDir, href, consumedAssets);
      return `<style>\n${escapeInlineStyle(css)}\n</style>`;
    },
  );

  // Inline module scripts.
  html = await replaceAsync(
    html,
    /<script\s+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/gi,
    async (match, src) => {
      const js = await readBuildAsset(outDir, src, consumedAssets);
      inlineScripts.push(
        `<script>\n(() => {\n${escapeInlineScript(js)}\n})();\n</script>`,
      );
      return '';
    },
  );

  // Verify no external asset references remain.
  if (/\b(?:src|href)\s*=\s*"[^"]*\/assets\//i.test(html)) {
    throw new Error('Covas widget still references external build assets.');
  }

  // Warn if assets/ dir has unconsumed files.
  const assetsDir = path.join(outDir, 'assets');
  if (existsSync(assetsDir)) {
    const leftovers = (await readdir(assetsDir)).filter(
      (n) => !consumedAssets.has(`assets/${n}`),
    );
    if (leftovers.length > 0) {
      throw new Error(
        `Covas widget build emitted non-inlined assets: ${leftovers.join(', ')}.`,
      );
    }
  }

  // Append inlined scripts before </body>.
  if (inlineScripts.length > 0) {
    const scripts = inlineScripts.join('\n');
    html = html.includes('</body>')
      ? html.replace('</body>', `${scripts}\n</body>`)
      : `${html}\n${scripts}`;
  }

  assertCspCompatibleStaticHtml(html);
  return html;
}

async function readBuildAsset(outDir, assetPath, consumedAssets) {
  const normalized = assetPath.replace(/^\//, '');
  consumedAssets?.add(normalized);
  return readFile(path.join(outDir, normalized), 'utf8');
}

// ─── CSP校验 ────────────────────────────────────────────────────────────────

function assertCspCompatibleStaticHtml(html) {
  // Strip all script/style content to inspect the shell markup only.
  const shellMarkup = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');

  const forbiddenShellPatterns = [
    [/<script\b[^>]+\bsrc\s*=/i, 'external script tag'],
    [/<script\b[^>]*\btype\s*=\s*["']module["']/i, 'module script tag'],
    [/<link\b[^>]+\bhref\s*=/i, 'external link tag'],
    [/<iframe\b/i, 'iframe tag'],
    [/<(?:object|embed|base)\b/i, 'embedded/base tag'],
  ];

  for (const [pattern, label] of forbiddenShellPatterns) {
    if (pattern.test(shellMarkup)) {
      throw new Error(`Covas widget is not CSP-compatible: found ${label}.`);
    }
  }

  for (const value of resourceAttributeValues(shellMarkup)) {
    if (isExternalResourceValue(value)) {
      throw new Error(
        `Covas widget is not CSP-compatible: found external resource ${value}.`,
      );
    }
  }
}

function resourceAttributeValues(markup) {
  return Array.from(
    markup.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi),
    (m) => m[2].trim(),
  );
}

function isExternalResourceValue(value) {
  if (!value) return false;
  if (/^(?:#|data:|blob:|about:blank\b)/i.test(value)) return false;
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|\.{1,2}\/)/i.test(value);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function replaceAsync(source, pattern, replacer) {
  const matches = Array.from(source.matchAll(pattern));
  let result = '';
  let lastIndex = 0;

  for (const match of matches) {
    result += source.slice(lastIndex, match.index);
    result += await replacer(...match);
    lastIndex = match.index + match[0].length;
  }

  return result + source.slice(lastIndex);
}

function escapeInlineScript(source) {
  return source
    .replaceAll('</script', '<\\/script')
    .replaceAll('</SCRIPT', '<\\/SCRIPT');
}

function escapeInlineStyle(source) {
  return source
    .replaceAll('</style', '<\\/style')
    .replaceAll('</STYLE', '<\\/STYLE');
}
