import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
const upstream = JSON.parse(await readFile(join(root, 'licenses/sources.json'), 'utf8'));
const entries = [], notices = [];
for (const [path, meta] of Object.entries(lock.packages)) {
  if (!path || !meta.version || meta.link) continue;
  let pkg;
  try { pkg = JSON.parse(await readFile(join(root, path, 'package.json'), 'utf8')); }
  catch { if (meta.optional) continue; throw new Error(`No se puede verificar la dependencia instalada: ${path}`); }
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? 'UNKNOWN';
  const runtime = !meta.dev && !meta.devOptional;
  const files = (await readdir(join(root, path))).filter(name => /^(licen[cs]e|copying|notice|copyright)([._-]|$)/i.test(name));
  const texts = [];
  for (const file of files) {
    try { const content = (await readFile(join(root, path, file), 'utf8')).replace(/\r\n/g, '\n'); texts.push({ file, content }); }
    catch { /* Directories are not license files. */ }
  }
  const fallback = upstream[`${pkg.name}@${pkg.version}`];
  if (!texts.length && fallback) texts.push({ file: `upstream ${fallback.source}`, content: (await readFile(join(root, 'licenses', fallback.file), 'utf8')).replace(/\r\n/g, '\n') });
  if (runtime && (!texts.length || !['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', '0BSD', 'CC0-1.0'].includes(license))) throw new Error(`Revisión manual requerida para ${pkg.name}: ${license}, ${texts.length} avisos.`);
  entries.push({ name: pkg.name, version: pkg.version, license, scope: runtime ? 'runtime' : 'development', path, notices: texts.map(t => ({ file: t.file, sha256: createHash('sha256').update(t.content).digest('hex') })) });
  if (runtime) notices.push(`=== ${pkg.name} ${pkg.version} · ${license} ===\n${texts.map(t => `--- ${t.file} ---\n${t.content}`).join('\n')}`);
}
entries.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const modelSource = await readFile(join(root, 'src/ai/model.ts'), 'utf8');
const modelLicense = await readFile(join(root, 'public/QWEN-LICENSE.txt'), 'utf8');
if (!modelLicense.includes('Apache License') || !modelLicense.includes('Version 2.0')) throw new Error('Licencia Qwen ausente o inesperada.');
const model = { id: modelSource.match(/MODEL_ID = '([^']+)'/)[1], weights: modelSource.match(/MODEL_BASE = '([^']+)'/)[1], runtime: modelSource.match(/MODEL_LIB = '([^']+)'/)[1], license: 'Apache-2.0', licenseFile: '/QWEN-LICENSE.txt', licenseSha256: createHash('sha256').update(modelLicense).digest('hex'), bundledWeights: false };
await writeFile(join(root, 'public/THIRD_PARTY_NOTICES.txt'), 'ECHO: THE AWAKENING — avisos de dependencias distribuidas\nGenerado desde package-lock.json y las licencias instaladas.\n\n' + notices.join('\n\n'));
await writeFile(join(root, 'public/licenses.json'), JSON.stringify({ source: 'package-lock.json + installed runtime license files (LF normalized)', model, packages: entries.filter(e => e.scope === 'runtime') }, null, 2) + '\n');
console.log(`Licencias: ${entries.filter(e => e.scope === 'runtime').length} runtime y ${entries.filter(e => e.scope === 'development').length} desarrollo inventariadas; avisos de runtime incluidos.`);
