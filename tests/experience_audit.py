"""Real player-camera captures from explicit saved checkpoints, not a physical playthrough."""
import os,sys,json,ast,math
from pathlib import Path
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'work'/'python'))
from playwright.sync_api import sync_playwright,expect
sys.stdout.reconfigure(encoding='utf-8');os.environ['TEMP']=os.environ['TMP']=str(root/'work'/'temp')
base=sys.argv[1] if len(sys.argv)>1 else 'https://echo-the-awakening.pages.dev/'
label=sys.argv[2] if len(sys.argv)>2 else 'before'
target=root/'outputs'/f'polish-{label}';target.mkdir(exist_ok=True)
full={'cell':True,'installed':True,'power':True,'door':True,'complete':False,
      'story':{'version':1,'seenLab':True,'seenCore':True,'stats':{}}}
results=[]
benchmark=ast.parse((root/'tests'/'release_benchmark.py').read_text(encoding='utf-8'))
instrument=ast.literal_eval(next(n.value for n in benchmark.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='instrument' for t in n.targets)))
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--enable-unsafe-webgpu'])
    browser_version=browser.version
    gpu=None
    for zone in ['intro','containment','lab','core','mobile']:
        mobile=zone=='mobile'
        context=browser.new_context(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 900},device_scale_factor=1,is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
        page=context.new_page();errors=[];warnings=[]
        page.add_init_script(instrument)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else warnings.append(m.text) if m.type=='warning' else None)
        if zone in ['lab','core']:
            state=json.loads(json.dumps(full));state['complete']=False
            state['story'].update({'zone':zone,'protocol':'none','archiveVerified':False,'order':[],'stance':'undecided','labSolved':zone=='core','dials':[2,4,3] if zone=='core' else [0,0,0],'documents':['shift','evacuation','manual','measurements','copy'] if zone=='core' else ['shift','evacuation'],'stats':{k:0 for k in state['story']['stats']}})
            page.add_init_script('localStorage.setItem("echo.awakening.v1",'+json.dumps(json.dumps(state))+')')
        page.goto(base,wait_until='networkidle')
        start=page.get_by_role('button',name='CONTINUE EXPERIENCE' if zone in ['lab','core'] else 'START EXPERIENCE')
        expect(start).to_be_enabled(timeout=30000)
        if gpu is None:
            gpu=page.evaluate("async()=>{const a=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});return {vendor:a?.info?.vendor,architecture:a?.info?.architecture,f16:a?.features.has('shader-f16')}}")
        ready=page.evaluate('performance.now()')
        if zone in ['intro','mobile']:
            page.screenshot(path=str(target/f'{zone}.png'))
            styles=page.evaluate("""()=>Object.fromEntries(['.intro-copy','.intro-controls','.start-button','.system-entry'].map(s=>{const e=document.querySelector(s),c=getComputedStyle(e),r=e.getBoundingClientRect();return[s,{font:c.fontSize,color:c.color,top:r.top,bottom:r.bottom}]}))""")
            styles['boot']=page.evaluate("()=>({readyMs:releaseQA.readyMs,jsBytes:performance.getEntriesByType('resource').filter(r=>/\\.js($|\\?)/.test(r.name)).reduce((sum,r)=>sum+r.decodedBodySize,0)})")
            if zone=='intro':
                page.get_by_role('button',name='Behind the System',exact=False).click();expect(page.locator('.architecture-node')).to_have_count(8)
                page.screenshot(path=str(target/'system.png'))
            else:
                start.tap();page.screenshot(path=str(target/'mobile-playing.png'))
        else:
            page.get_by_role('button',name='Ajustes y controles').click();page.get_by_label('Control de cámara').select_option('drag');page.get_by_label('Calidad gráfica').select_option('medium');page.get_by_role('button',name='Volver',exact=True).click();start.click()
            tree=ast.parse((root/'tests'/'playthrough.py').read_text(encoding='utf-8'));node=next(n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name=='bind_runtime')
            exec(compile(ast.Module(body=[node],type_ignores=[]),'bind_runtime','exec'));bind_runtime()
            aim_at=[0,2.3,0] if zone=='containment' else [0,2.6,-28] if zone=='lab' else [0,4.2,-49]
            for _ in range(8):
                pose=page.evaluate("()=>{const c=qaScene.getState().camera;return {p:c.position.toArray(),d:c.getWorldDirection(c.position.clone()).toArray()}}")
                x,y,z=pose['p'];dx,dy,dz=pose['d'];tx,ty,tz=aim_at
                desired=math.atan2(-(tx-x),-(tz-z));actual=math.atan2(-dx,-dz);yaw=(desired-actual+math.pi)%(math.pi*2)-math.pi
                pitch=math.atan2(ty-y,math.hypot(tx-x,tz-z))-math.asin(dy)
                if abs(yaw)<.005 and abs(pitch)<.005:break
                mx=max(-450,min(450,-yaw/.0022));my=max(-300,min(300,-pitch/.0022))
                page.mouse.move(850,400);page.mouse.down();page.mouse.move(850+mx,400+my,steps=3);page.mouse.up();page.wait_for_timeout(140)
            page.wait_for_timeout(1800)
            page.screenshot(path=str(target/f'{zone}.png'))
            styles=page.evaluate("""()=>{const s=qaScene.getState();return {position:s.camera.position.toArray(),direction:s.camera.getWorldDirection(s.camera.position.clone()).toArray(),backend:qaGame.getState().backend,geometries:s.gl.info.memory.geometries,textures:s.gl.info.memory.textures}}""")
            styles['measurement']=page.evaluate('''async()=>{
              const dt=[],draws=[],triangles=[];let last=performance.now(),d=releaseQA.draws,t=releaseQA.triangles;
              for(let i=0;i<180;i++){await new Promise(requestAnimationFrame);const now=performance.now();dt.push(now-last);last=now;draws.push(releaseQA.draws-d);triangles.push(releaseQA.triangles-t);d=releaseQA.draws;t=releaseQA.triangles;}
              const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)],seconds=dt.reduce((a,b)=>a+b,0)/1000;
              return {submittedFps:draws.filter(d=>d>0).length/seconds,frameMedianMs:median(dt),drawCallsMedian:median(draws),trianglesMedian:median(triangles),readyMs:releaseQA.readyMs};
            }''')
            cdp=context.new_cdp_session(page);cdp.send('HeapProfiler.collectGarbage')
            styles['measurement']['v8HeapRetainedBytes']=cdp.send('Runtime.getHeapUsage')['usedSize']
            assert styles['measurement']['drawCallsMedian']>0,styles
            if zone=='lab':
                # Explicit terminal UI fixture, separate from the real camera shot above.
                page.evaluate("qaGame.setState({phase:'terminal',activeTerminal:'lab'})")
                expect(page.get_by_label('Tu instrucción')).to_be_visible();page.screenshot(path=str(target/'terminal.png'))
        assert not errors,errors
        results.append({'view':zone,'readyObservedMs':ready,'detail':styles,'warnings':warnings,'errors':errors})
        context.close()
    browser.close()
(target/'audit.json').write_text(json.dumps({'url':base,'browser':browser_version,'gpu':gpu,'scope':'explicit save checkpoints; actual player cameras via mouse input; no model download; one 180-frame sample per zone at medium, DPR1','results':results},ensure_ascii=False,indent=2),encoding='utf-8')
print('EXPERIENCE AUDIT PASS',label,flush=True)
