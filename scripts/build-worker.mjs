// Bundles the Cloudflare Worker (server/src/index.ts and everything it imports) into a single
// _worker.js file inside the Angular build output — Cloudflare Pages' "Advanced Mode" runs
// whatever _worker.js it finds in the output directory instead of static-only serving, and (per
// Cloudflare's docs) it must already be pre-compiled JS in Module Worker syntax, not TypeScript
// and not a directory of files — hence bundling here rather than just copying server/src as-is.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

await build({
  entryPoints: [path.join(root, 'server/src/index.ts')],
  outfile: path.join(root, 'dist/redline/browser/_worker.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser', // Workers runtime, not Node — no Node built-ins to polyfill
  minify: true,
  logLevel: 'info',
});
