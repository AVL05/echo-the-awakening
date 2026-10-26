import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),base=process.argv[2]?.replace(/\/$/,'');
assert(base?.startsWith('https://'), 'Provide the actual public HTTPS URL.');
const hash=body=>createHash('sha256').update(body).digest('hex');
const files=[];
async function walk(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isDirectory())await walk(join(dir,entry.name),name+'/');else if(!['_headers','_redirects'].includes(name))files.push(name);}}
await walk(join(root,'dist'));
const results=[];
for(const file of files){
  const response=await fetch(base+'/'+file,{signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200,file);
  const body=Buffer.from(await response.arrayBuffer());
  assert.equal(hash(body),hash(await readFile(join(root,'dist',file))),`Public build differs: ${file}`);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff',file);
  assert.equal(response.headers.get('x-frame-options'),'DENY',file);
  const csp=response.headers.get('content-security-policy');
  assert(csp?.includes("worker-src 'self' blob:")&&csp.includes("frame-ancestors 'none'"),file);
  if(file.startsWith('assets/'))assert(response.headers.get('cache-control')?.includes('max-age=31536000, immutable'),file);
  results.push({file,status:response.status,bytes:body.length,sha256:hash(body),cacheControl:response.headers.get('cache-control'),contentType:response.headers.get('content-type'),csp});
}
const index=hash(await readFile(join(root,'dist/index.html')));
for(const path of ['/','/behind-the-system','/.env','/package.json','/src/ai/model.ts']){
  const response=await fetch(base+path,{signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200,path);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())),index,`Unexpected exposed content at ${path}`);
  assert(response.headers.get('content-type')?.includes('text/html'),path);
  results.push({path,status:response.status,type:'SPA HTML; no source/private content exposed',cacheControl:response.headers.get('cache-control')});
}
const redirect=await fetch(base.replace('https:','http:')+'/',{redirect:'manual',signal:AbortSignal.timeout(15000)});
assert([301,302,307,308].includes(redirect.status));assert(redirect.headers.get('location')?.startsWith(base));
const report={status:'PASS',url:base,checkedAt:new Date().toISOString(),publicFiles:files.length,results,httpToHttps:redirect.status,note:'Actual public TLS and HTTP headers; no certificate validation bypass. Browser gameplay and inference are separate tests.'};
await mkdir(join(root,'outputs'), { recursive: true });
await writeFile(join(root,'outputs/PUBLIC-HTTP.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,url:base,publicFiles:files.length,routes:5,httpToHttps:redirect.status}));
