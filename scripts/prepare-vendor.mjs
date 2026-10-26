import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'dist/vendor');
await mkdir(destination, { recursive: true });
for (const filename of ['three.module.js', 'three.core.js']) {
  try { await copyFile(resolve(root, 'node_modules/three/build', filename), resolve(destination, filename)); }
  catch { throw new Error('Install dependencies first: npm install'); }
}
console.log('Three.js 0.180.0 prepared in dist/vendor.');
