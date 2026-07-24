/**
 * mcp/lib/plugin-root.mjs
 *
 * Resolves paths relative to the Covas monorepo root.
 * The monorepo root is one level above `mcp/`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// mcp/lib/ → mcp/ → <root>
const DEFAULT_PLUGIN_ROOT = path.resolve(__dirname, '..', '..');

export function pluginRoot() {
  return process.env.COVAS_PLUGIN_ROOT
    ? path.resolve(process.env.COVAS_PLUGIN_ROOT)
    : DEFAULT_PLUGIN_ROOT;
}

export function pluginPath(...parts) {
  return path.join(pluginRoot(), ...parts);
}
