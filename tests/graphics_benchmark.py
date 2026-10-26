"""Local browser frame pacing and renderer counters; not a production GPU benchmark."""
import os, sys, json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'work'/'python'))
from playwright.sync_api import sync_playwright, expect
sys.stdout.reconfigure(encoding='utf-8')
(root/'work'/'temp').mkdir(parents=True,exist_ok=True)
(root/'outputs').mkdir(exist_ok=True)
os.environ['TEMP']=os.environ['TMP']=str(root/'work'/'temp')
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--enable-unsafe-webgpu'])
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5173/?renderer=webgl'
    page.goto(url,wait_until='networkidle')
    expect(page.get_by_role('button',name='START EXPERIENCE')).to_be_enabled(timeout=30000)
    page.evaluate('''async()=>{
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/@react-three_fiber.js')).name;
      const fiber=await import(url);window.qa=fiber._roots.get(document.querySelector('canvas')).store;
    }''')
    zone=os.environ.get('ECHO_ZONE','containment')
    assert zone in ['containment','lab','core']
    if zone!='containment':
        # Controlled camera fixture for renderer measurements; not a gameplay route.
        page.evaluate('''async(zone)=>{
          const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name;
          window.zoneGame=(await import(url)).useGame;
          const p=zoneGame.getState().progress;
          zoneGame.setState({phase:'cinematic',cinematic:null,progress:{...p,cell:true,installed:true,power:true,door:true,story:{...p.story,zone,seenLab:true,seenCore:true,documents:['evacuation','shift','manual','measurements','copy','quarantine','consent'],dials:[2,4,3],labSolved:true,order:['copy','quarantine','cut'],archiveVerified:true}}});
        }''',zone)
        page.wait_for_timeout(500)
        page.evaluate('''(zone)=>{const c=qa.getState().camera;if(zone==='lab'){c.position.set(5,2.8,-19);c.lookAt(0,2,-28)}else{c.position.set(5.8,3.7,-42.5);c.lookAt(0,4.2,-49)}}''',zone)
    results=[]
    for tier in ['low','medium','high']:
        if zone=='containment':
            page.get_by_role('button',name='Ajustes y controles').click()
            page.get_by_label('Calidad gráfica').select_option(tier)
            page.get_by_role('button',name='Volver',exact=True).click()
        else:page.evaluate('(tier)=>zoneGame.setState({quality:tier,tier})',tier)
        page.wait_for_timeout(1800)
        result=page.evaluate('''async()=>{
          const samples=[],calls=[];let prev=performance.now();
          for(let i=0;i<150;i++){await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-prev);prev=now;const render=qa.getState().gl.info.render;calls.push(render.drawCalls??render.calls);}
          samples.sort((a,b)=>a-b);const {gl,scene}=qa.getState();const materials=[];
          scene.traverse(o=>{if(o.material?.name.includes('containment bands'))materials.push(o.material.name)});
          return {medianMs:samples[75],p95Ms:samples[142],drawCalls:Math.max(...calls),triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,dpr:gl.getPixelRatio(),shadowEnabled:gl.shadowMap.enabled,energyMaterials:materials,renderer:gl.isWebGPURenderer?'WebGPURenderer':'WebGLRenderer'};
        }''')
        result['profile']=tier;results.append(result)
        print(json.dumps(result,indent=2),flush=True)
        page.screenshot(path=str(root/'outputs'/f'cinematic-{zone}-{tier}.png'))
    assert results[0]['dpr']<results[1]['dpr']<=results[2]['dpr']
    assert not results[0]['shadowEnabled'] and results[1]['shadowEnabled']
    if zone=='containment':assert all(r['energyMaterials'] for r in results)
    assert not errors,errors
    report={'url':url,'zone':zone,'fixture':zone!='containment','viewport':[1440,900],'samplesPerProfile':150,'results':results,'errors':errors}
    label='webgpu' if results[0]['renderer']=='WebGPURenderer' else 'webgl'
    (root/'outputs'/f'graphics-{label}-{zone}.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    browser.close()
