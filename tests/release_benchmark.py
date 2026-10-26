"""Production, cold-cache load + fixed first-room camera. Instrument actual GPU draw submissions."""
import os, sys, json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'work'/'python'))
from playwright.sync_api import sync_playwright, expect
sys.stdout.reconfigure(encoding='utf-8')
os.environ['TEMP']=os.environ['TMP']=str(root/'work'/'temp')
url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4173/'
label=sys.argv[2] if len(sys.argv)>2 else 'before'
instrument=r"""(()=>{
  const qa=window.releaseQA={draws:0,triangles:0,longTasks:[],readyMs:null};
  new PerformanceObserver(list=>qa.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  const ready=()=>{if(qa.readyMs===null&&[...document.querySelectorAll('button')].some(b=>!b.disabled&&/START EXPERIENCE/.test(b.textContent)))qa.readyMs=performance.now()};
  new MutationObserver(ready).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
  const wrap=(proto,name,record)=>{if(!proto?.[name])return;const original=proto[name];proto[name]=function(...args){record(args,this);return Reflect.apply(original,this,args)}};
  const gl=window.WebGL2RenderingContext?.prototype;
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'])wrap(gl,name,args=>{
    qa.draws++;const count=name.includes('Elements')?args[1]:args[2];const instances=name.endsWith('Instanced')?args[name.includes('Elements')?4:3]:1;
    if(args[0]===4)qa.triangles+=Math.floor(count/3)*instances;
  });
  const topology=new WeakMap(),active=new WeakMap();
  if(window.GPUDevice){for(const name of ['createRenderPipeline','createRenderPipelineAsync']){
    const original=GPUDevice.prototype[name];GPUDevice.prototype[name]=function(desc){const r=Reflect.apply(original,this,[desc]);const save=p=>{topology.set(p,desc.primitive?.topology??'triangle-list');return p};return name.endsWith('Async')?r.then(save):save(r)};
  }}
  const pass=window.GPURenderPassEncoder?.prototype;
  wrap(pass,'setPipeline',(args,self)=>active.set(self,topology.get(args[0])));
  for(const name of ['draw','drawIndexed'])wrap(pass,name,(args,self)=>{qa.draws++;const mode=active.get(self);if(mode==='triangle-list')qa.triangles+=Math.floor(args[0]/3)*(args[1]??1);else if(mode==='triangle-strip')qa.triangles+=Math.max(0,args[0]-2)*(args[1]??1)});
})()"""
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--enable-unsafe-webgpu'])
    for trial in range(3):
        context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script(instrument)
        cdp=context.new_cdp_session(page);cdp.send('Network.enable');cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
        cdp.send('Profiler.enable');cdp.send('Profiler.start')
        page.goto(url,wait_until='networkidle')
        expect(page.get_by_role('button',name='START EXPERIENCE')).to_be_enabled(timeout=45000)
        cpu=cdp.send('Profiler.stop')['profile']
        page.get_by_role('button',name='Ajustes y controles').click()
        page.get_by_label('Calidad gráfica').select_option('medium')
        page.get_by_label('Control de cámara').select_option('drag')
        page.get_by_role('button',name='Volver',exact=True).click()
        page.get_by_role('button',name='START EXPERIENCE').click()
        if page.get_by_role('button',name='Entendido',exact=True).count():page.get_by_role('button',name='Entendido',exact=True).click()
        page.wait_for_timeout(2500)
        result=page.evaluate('''async()=>{
          const samples=[],draws=[],triangles=[];let prev=performance.now(),d=releaseQA.draws,t=releaseQA.triangles;
          for(let i=0;i<300;i++){await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-prev);prev=now;draws.push(releaseQA.draws-d);triangles.push(releaseQA.triangles-t);d=releaseQA.draws;t=releaseQA.triangles}
          const sorted=[...samples].sort((a,b)=>a-b),median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
          return {readyMs:releaseQA.readyMs,frameMedianMs:median(samples),frameP95Ms:sorted[285],fps:1000/(samples.reduce((s,v)=>s+v,0)/samples.length),drawCallsMedian:median(draws),trianglesMedian:median(triangles),longTasks:releaseQA.longTasks,resources:performance.getEntriesByType('resource').filter(e=>/\\.(js|css)(\\?|$)/.test(e.name)).map(e=>({url:e.name,bytes:e.decodedBodySize,duration:e.duration})),jsHeapBytes:performance.memory?.usedJSHeapSize??null};
        }''')
        cdp.send('HeapProfiler.collectGarbage')
        result['v8HeapRetainedBytes']=cdp.send('Runtime.getHeapUsage')['usedSize']
        nodes={n['id']:n for n in cpu['nodes']};timings={}
        for node,dt in zip(cpu.get('samples',[]),cpu.get('timeDeltas',[])):
            f=nodes[node]['callFrame'];key=f"{f['functionName']}@{f['url']}:{f['lineNumber']}:{f['columnNumber']}";timings[key]=timings.get(key,0)+dt
        result.update({'trial':trial+1,'renderer':page.locator('footer').inner_text(),'cpuTopMs':[{ 'frame':key,'ms':value/1000 } for key,value in sorted(timings.items(),key=lambda v:-v[1])[:18]],'errors':errors})
        assert not errors,errors
        results.append(result);print(json.dumps({k:v for k,v in result.items() if k not in ['cpuTopMs','resources','longTasks']},ensure_ascii=False),flush=True)
        (root/'work'/f'cpu-{label}-{trial}.json').write_text(json.dumps(cpu),encoding='utf-8')
        context.close()
    browser.close()
(root/'outputs'/f'RELEASE-{label}.json').write_text(json.dumps({'url':url,'viewport':[1440,900],'cache':'disabled','samples':300,'results':results},ensure_ascii=False,indent=2),encoding='utf-8')
