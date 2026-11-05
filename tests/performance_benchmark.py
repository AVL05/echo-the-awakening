"""Compiled build, rotating player camera, explicit saves; never a gameplay or GPU-utilization claim."""
import argparse, ast, json, os, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root/'work'/'python'))
from playwright.sync_api import sync_playwright, expect

sys.stdout.reconfigure(encoding='utf-8')
for directory in ['work/temp', 'outputs']:
    (root/directory).mkdir(parents=True, exist_ok=True)
os.environ['TEMP'] = os.environ['TMP'] = str(root/'work'/'temp')
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:4173/')
parser.add_argument('--label', default='local')
parser.add_argument('--quality', default='medium', choices=['auto','low','laptop','medium','high'])
parser.add_argument('--renderers', default='webgpu,webgl')
parser.add_argument('--zones', default='containment,lab,core')
parser.add_argument('--variants', default='normal', help='normal,shadows-off,dpr075,ray-off')
parser.add_argument('--runs', type=int, default=3)
parser.add_argument('--seconds', type=float, default=8)
parser.add_argument('--warmup', type=float, default=6)
parser.add_argument('--width', type=int, default=1920)
parser.add_argument('--height', type=int, default=1080)
parser.add_argument('--dpr', type=float, default=2)
parser.add_argument('--cpu-rate', type=float, default=1, help='CDP CPU throttling; synthetic stress, not laptop hardware')
parser.add_argument('--profile', action='store_true', help='Separate CDP CPU sampling and frame-callback instrumentation')
parser.add_argument('--screenshots', action='store_true', help='Capture actual zone cameras outside the timed sample')
parser.add_argument('--memory-cycles', type=int, default=0, help='Extra three-zone camera fixtures after timing; resource plateau probe, not physical gameplay')
args = parser.parse_args()
assert 0 < args.seconds <= 120 and 0 < args.runs <= 10 and args.cpu_rate >= 1
assert 0 <= args.memory_cycles <= 5
assert all(v in ['normal','shadows-off','dpr075','ray-off'] for v in args.variants.split(','))
assert all(r in ['webgpu','webgl'] for r in args.renderers.split(','))
assert all(z in ['containment','lab','core'] for z in args.zones.split(','))
tree = ast.parse((root/'tests'/'playthrough.py').read_text(encoding='utf-8'))
binding = next(n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name=='bind_runtime')
exec(compile(ast.Module(body=[binding],type_ignores=[]),'bind_runtime','exec'))
tree = ast.parse((root/'tests'/'release_benchmark.py').read_text(encoding='utf-8'))
instrument = ast.literal_eval(next(n.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='instrument' for t in n.targets)))
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--enable-unsafe-webgpu'])
    version=browser.version
    for renderer in args.renderers.split(','):
      for zone in args.zones.split(','):
       for variant in args.variants.split(','):
        for trial in range(args.runs):
            context=browser.new_context(viewport={'width':args.width,'height':args.height},device_scale_factor=.75 if variant=='dpr075' else args.dpr)
            page=context.new_page();errors=[];external=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('request',lambda r:external.append(r.url) if not r.url.startswith((args.url.rstrip('/'),'blob:','data:')) else None)
            page.add_init_script(instrument)
            page.add_init_script('''(()=>{window.benchWorkers=[];const Original=Worker;window.Worker=class extends Original{constructor(...a){super(...a);benchWorkers.push(String(a[0]));}}})()''')
            save={'cell':True,'installed':True,'power':True,'door':True,'complete':False,'story':{'version':1,'zone':zone,'seenLab':True,'seenCore':True,'labSolved':True,'dials':[2,4,3],'protocol':'none','documents':['shift','evacuation','manual','measurements','copy','quarantine','consent']}}
            page.add_init_script('localStorage.setItem("echo.awakening.v1",'+json.dumps(json.dumps(save))+')')
            cdp=context.new_cdp_session(page)
            if args.cpu_rate>1:cdp.send('Emulation.setCPUThrottlingRate',{'rate':args.cpu_rate})
            page.goto(args.url+'?renderer='+renderer,wait_until='networkidle')
            expect(page.get_by_role('button',name='CONTINUE EXPERIENCE')).to_be_enabled(timeout=45000)
            page.get_by_role('button',name='Ajustes y controles').click()
            page.get_by_label('Calidad gráfica').select_option(args.quality)
            page.get_by_label('Control de cámara').select_option('drag')
            page.get_by_role('button',name='Volver',exact=True).click()
            page.get_by_role('button',name='CONTINUE EXPERIENCE').click();bind_runtime()
            assert page.evaluate('qaGame.getState().progress.story.zone')==zone,'Save fixture was repaired to another zone'
            assert page.evaluate('qaGame.getState().progress.story.labSolved'),'Benchmark requires all three zones unlocked'
            if variant=='shadows-off':page.evaluate('()=>qaScene.getState().scene.traverse(o=>{if(o.isLight)o.castShadow=false})')
            page.evaluate('''(variant)=>{
              const root=qaScene.getState(),proto=Object.getPrototypeOf(root.raycaster),original=proto.intersectObjects;
              window.benchRay={calls:0,ms:0};proto.intersectObjects=function(...a){const t=performance.now();try{return variant==='ray-off'?[]:Reflect.apply(original,this,a)}finally{benchRay.calls++;benchRay.ms+=performance.now()-t}};
            }''',variant)
            page.keyboard.down('ArrowRight');page.wait_for_timeout(args.warmup*1000)
            if args.profile:
                page.evaluate('''()=>{window.benchMatrix=0;const proto=Object.getPrototypeOf(Object.getPrototypeOf(qaScene.getState().scene)),update=proto.updateMatrixWorld;proto.updateMatrixWorld=function(...a){benchMatrix++;return Reflect.apply(update,this,a)}}''')
                page.evaluate('''()=>{window.benchGeometry={created:0,disposed:0};const seen=new Set();const watch=(initial=false)=>qaScene.getState().scene.traverse(o=>{const g=o.geometry;if(g&&!seen.has(g.uuid)){seen.add(g.uuid);if(!initial)benchGeometry.created++;g.addEventListener('dispose',()=>benchGeometry.disposed++)}});watch(true);window.benchGeometryTimer=setInterval(watch,250)}''')
                page.evaluate('''()=>{window.benchCallbacks=[];for(const sub of qaScene.getState().internal.subscribers){const ref=sub.ref;let fn=ref.current;const stat={code:String(fn).slice(0,320),calls:0,ms:0};benchCallbacks.push(stat);const wrap=(...a)=>{const t=performance.now();try{return fn(...a)}finally{stat.calls++;stat.ms+=performance.now()-t}};Object.defineProperty(ref,'current',{get:()=>wrap,set:v=>{fn=v},configurable:true});}}''')
                cdp.send('Profiler.enable');cdp.send('Profiler.start')
            sample=page.evaluate('''async(seconds)=>{
              const dt=[],draws=[],triangles=[],changes=[];const begin=performance.now(),rayStart={...benchRay};let last=begin,d=releaseQA.draws,t=releaseQA.triangles,previous='';
              while(performance.now()-begin<seconds*1000){await new Promise(requestAnimationFrame);const now=performance.now(),game=qaGame.getState(),root=qaScene.getState(),state=game.tier+'/'+root.gl.getPixelRatio();dt.push(now-last);last=now;draws.push(releaseQA.draws-d);triangles.push(releaseQA.triangles-t);d=releaseQA.draws;t=releaseQA.triangles;if(state!==previous){changes.push({ms:now-begin,state});previous=state}}
              const sorted=[...dt].sort((a,b)=>a-b),quantile=p=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)],median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
              const root=qaScene.getState(),gl=root.gl;let materials=new Set(),textures=new Set(),meshes=0,hidden=0,shadowLights=0;root.scene.traverse(o=>{if(o.isLight&&o.castShadow)shadowLights++;if(o.isMesh)meshes++;let visible=true;for(let n=o;n;n=n.parent)if(!n.visible)visible=false;if(!visible)hidden++;for(const m of (Array.isArray(o.material)?o.material:o.material?[o.material]:[])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v)}});
              const info=gl.backend?.device?.adapterInfo,context=info?null:gl.getContext(),debug=context?.getExtension?.('WEBGL_debug_renderer_info');
              return {fps:dt.length*1000/(last-begin),submittedFps:draws.filter(d=>d>0).length*1000/(last-begin),frameMs:(last-begin)/dt.length,p50:quantile(.5),p95:quantile(.95),p99:quantile(.99),max:Math.max(...dt),over33:dt.filter(t=>t>33.34).length,over50:dt.filter(t=>t>50).length,samples:dt.length,drawCalls:median(draws),triangles:median(triangles),dpr:gl.getPixelRatio(),backend:qaGame.getState().backend,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,sceneMaterials:materials.size,sceneTextures:textures.size,sceneMeshes:meshes,hiddenObjects:hidden,shadowLights,frameSubscribers:root.internal.subscribers.length,qualityChanges:changes,workers:benchWorkers,modelChunkFetched:performance.getEntriesByType('resource').some(e=>e.name.includes('echo.worker')),ray:{calls:benchRay.calls-rayStart.calls,ms:benchRay.ms-rayStart.ms},callbacks:window.benchCallbacks??null,gpu:info?{vendor:info.vendor,architecture:info.architecture}:debug?{renderer:context.getParameter(debug.UNMASKED_RENDERER_WEBGL)}:null,longTasks:releaseQA.longTasks.filter(t=>t.start>=begin)};
            }''',args.seconds)
            page.keyboard.up('ArrowRight')
            if args.screenshots:page.screenshot(path=str(root/'outputs'/f'perf-{args.label}-{renderer}-{zone}-{trial+1}.png'))
            if args.profile:
                sample['geometryChurn']=page.evaluate('()=>{clearInterval(benchGeometryTimer);return benchGeometry}')
                sample['matrixUpdatesPerFrame']=page.evaluate('benchMatrix')/sample['samples']
                cpu=cdp.send('Profiler.stop')['profile'];nodes={n['id']:n for n in cpu['nodes']};timings={}
                for node,delta in zip(cpu.get('samples',[]),cpu.get('timeDeltas',[])):
                    f=nodes[node]['callFrame'];key=f"{f['functionName']}@{f['url']}:{f['lineNumber']}:{f['columnNumber']}";timings[key]=timings.get(key,0)+delta
                sample['cpuTop']=[{'frame':k,'ms':v/1000} for k,v in sorted(timings.items(),key=lambda kv:-kv[1])[:20]]
                (root/'work'/f'profile-{args.label}-{renderer}-{zone}-{variant}-{trial}.json').write_text(json.dumps(cpu),encoding='utf-8')
            cdp.send('HeapProfiler.collectGarbage');sample['retainedJsBytes']=cdp.send('Runtime.getHeapUsage')['usedSize']
            if args.memory_cycles:
                sample['memoryCycles']=[]
                for cycle in range(args.memory_cycles):
                    page.keyboard.down('ArrowRight')
                    for z in [5,-27,-51]:
                        page.evaluate('(z)=>qaScene.getState().camera.position.set(4,1.7,z)',z)
                        page.wait_for_timeout(4500)
                    page.keyboard.up('ArrowRight');cdp.send('HeapProfiler.collectGarbage')
                    sample['memoryCycles'].append({'cycle':cycle+1,'retainedJsBytes':cdp.send('Runtime.getHeapUsage')['usedSize'],'renderer':page.evaluate('({...qaScene.getState().gl.info.memory})')})
            sample.update({'rendererRequested':renderer,'zone':zone,'variant':variant,'trial':trial+1,'errors':errors})
            assert not errors and not external,(errors,external)
            assert not sample['workers'] and not sample['modelChunkFetched'],'Model runtime initialized without consent'
            assert page.evaluate("benchWorkers.length===0&&!performance.getEntriesByType('resource').some(e=>e.name.includes('echo.worker'))"),'Model runtime loaded during zone transitions'
            assert sample['drawCalls']>0 and sample['samples']>0,sample
            assert sample['backend']==('WEBGPU' if renderer=='webgpu' else 'WEBGL 2'),sample['backend']
            results.append(sample);print(json.dumps({k:v for k,v in sample.items() if k not in ['cpuTop','callbacks','longTasks']},ensure_ascii=False),flush=True)
            report={'browser':version,'config':vars(args),'scope':'headless Chrome; integrated/discrete adapter as reported; explicit completed-zone fixtures; rotating camera, no physical route; GPU utilization and total VRAM are not measured','results':results}
            (root/'outputs'/f'PERF-{args.label}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
            context.close()
    browser.close()
