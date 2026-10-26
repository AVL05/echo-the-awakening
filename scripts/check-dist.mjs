import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..'), dist = join(root, 'dist');
const files = [];
async function visit(path) { for (const e of await readdir(path, { withFileTypes: true })) { const file = join(path, e.name); if (e.isDirectory()) await visit(file); else files.push({ path: relative(dist, file).replaceAll('\\', '/'), bytes: (await stat(file)).size }); } }
await visit(dist);
assert(files.length < 20000, 'Límite de archivos de Pages Free excedido.');
assert(files.every(f => f.bytes <= 25 * 1024 * 1024), 'Un archivo supera 25 MiB. No empaquetes los pesos del modelo en Pages.');
for (const path of ['index.html', '_headers', '_redirects', 'THIRD_PARTY_NOTICES.txt', 'QWEN-LICENSE.txt', 'licenses.json']) assert(files.some(f => f.path === path), `Falta ${path}`);
for (const file of files) {
  assert(/^(?:index\.html|echo\.svg|_headers|_redirects|THIRD_PARTY_NOTICES\.txt|QWEN-LICENSE\.txt|licenses\.json|assets\/[\w.-]+\.(?:js|css))$/.test(file.path), `Archivo no previsto para publicación: ${file.path}`);
  const content = await readFile(join(dist, file.path), 'utf8');
  assert(!/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{40,}/.test(content), `Posible secreto en ${file.path}; revisa antes de publicar.`);
}
assert(!files.some(f => /\.(bin|wasm|safetensors)$/.test(f.path)), 'Pesos/runtime del modelo inesperadamente empaquetados.');
const headers = await readFile(join(dist, '_headers'), 'utf8');
for (const required of ['wasm-unsafe-eval', "frame-ancestors 'none'", "form-action 'self'", 'max-age=31536000, immutable', 'max-age=0, must-revalidate']) assert(headers.includes(required), `Falta cabecera: ${required}`);
assert(headers.split('\n').every(line => line.length < 2000), 'Cabecera demasiado larga para Pages.');
assert((await readFile(join(dist, '_redirects'), 'utf8')).includes('/behind-the-system /index.html 200'), 'Falta la ruta técnica.');
const license = JSON.parse(await readFile(join(dist, 'licenses.json'), 'utf8'));
assert(license.model.bundledWeights === false && /\/resolve\/[a-f0-9]{40}\//.test(license.model.weights), 'El modelo debe ser voluntario y fijado a una revisión.');
console.log(JSON.stringify({ status: 'PASS', files: files.length, totalBytes: files.reduce((s, f) => s + f.bytes, 0), largest: [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 5), scope: 'Local static audit only; verify the deployed URL separately with check-public.mjs and browser tests.' }, null, 2));
