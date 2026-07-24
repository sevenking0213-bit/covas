/**
 * scripts/start-mcp.mjs
 *
 * Entry point for the Covas MCP server. Runs as a long-lived child process.
 * The build is triggered lazily on first widget render inside
 * mcp/lib/covas-static-widget.mjs — this script only starts the server.
 *
 * Usage (invoked by Codex via .mcp.json):
 *   node scripts/start-mcp.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const REQUIRED_DEPENDENCIES = [
  '@modelcontextprotocol/ext-apps',
  '@modelcontextprotocol/sdk',
  '@vitejs/plugin-react',
  'react',
  'react-dom',
  'vite',
  'vite-plugin-singlefile',
  'zod',
];

function depPath(name) {
  return path.join(ROOT, 'node_modules', ...name.split('/'));
}

function missingDeps() {
  return REQUIRED_DEPENDENCIES.filter((name) => !existsSync(depPath(name)));
}

function runNpmInstall() {
  console.error('[covas] Installing dependencies...');
  const result = spawnSync('npm', ['install'], {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: '0' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `npm install failed in Covas (exit ${result.status}).`,
    );
  }
}

const missing = missingDeps();
if (missing.length > 0) {
  console.error(`[covas] Missing dependencies: ${missing.join(', ')}`);
  runNpmInstall();
  const stillMissing = missingDeps();
  if (stillMissing.length > 0) {
    console.error(`[covas] Still missing after install: ${stillMissing.join(', ')}`);
    process.exit(1);
  }
}

// Start the MCP server. The stdio transport reads JSON-RPC messages from
// stdin and writes responses to stdout.
await import(path.resolve(ROOT, 'mcp', 'server.mjs'));
