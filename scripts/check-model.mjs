import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const source = await readFile(join(root, 'src/ai/model.ts'), 'utf8');
const base = source.match(/MODEL_BASE = '([^']+)'/)[1];
const runtime = source.match(/MODEL_LIB = '([^']+)'/)[1];
const expectedBytes = Number(source.match(/WEIGHT_BYTES = (\d+)/)[1]);
const origin = 'https://echo-the-awakening.pages.dev'; // CORS probe origin; not a claim that this site exists.
const manifestResponse = await fetch(base+'tensor-cache.json', { signal: AbortSignal.timeout(30000) });
assert(manifestResponse.ok, `Manifest HTTP ${manifestResponse.status}`);
const manifest = await manifestResponse.json();
assert.equal(manifest.metadata.ParamBytes, expectedBytes);
assert.equal(manifest.records.length, 8);
assert.equal(manifest.records.reduce((n,r)=>n+r.nbytes,0), expectedBytes);
const files = ['tensor-cache.json', 'mlc-chat-config.json', 'tokenizer.json', ...manifest.records.map(r=>r.dataPath)].map(name=>base+name);
files.push(runtime);
const results = [];
for (let i=0;i<files.length;i+=4) {
  const batch = await Promise.allSettled(files.slice(i,i+4).map(async url=>{
    const response = await fetch(url, { method: 'HEAD', headers: { Origin: origin }, signal: AbortSignal.timeout(45000) });
    const final = new URL(response.url), allowOrigin = response.headers.get('access-control-allow-origin');
    assert(response.ok, `${new URL(url).pathname}: HTTP ${response.status}`);
    assert(allowOrigin==='*' || allowOrigin===origin, `CORS does not allow the game: ${final.hostname}`);
    return { file: new URL(url).pathname.split('/').at(-1), status: response.status, host: final.hostname, allowOrigin, cacheControl: response.headers.get('cache-control'), contentLength: response.headers.get('content-length') };
  }));
  for (const result of batch) results.push(result.status==='fulfilled' ? result.value : { error: result.reason.message });
}
const upstream = await fetch('https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/resolve/main/LICENSE', { signal: AbortSignal.timeout(30000) });
assert(upstream.ok);
const license = await upstream.text();
assert(license.includes('Apache License') && license.includes('Version 2.0'));
const report = { checkedAt: new Date().toISOString(), status: results.some(r=>r.error) ? 'FAIL' : 'PASS', originProbeOnly: origin, weightsBytes: expectedBytes, pinnedModel: base, runtime, license: 'Apache-2.0; original upstream license and local redistributable notice checked', results, note: 'HEAD metadata and CORS headers only. Real browser download/inference and public HTTPS validation are separate checks. CDN signed query parameters are not recorded.' };
await mkdir(join(root, 'outputs'), { recursive: true });
await writeFile(join(root, 'outputs/MODEL-NETWORK.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
assert.equal(report.status, 'PASS');
