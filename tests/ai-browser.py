"""Opt-in real WebGPU inference test. Downloads only the selected model, into a project-owned profile."""
import os, sys, time, json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'work'/'python'))
from playwright.sync_api import sync_playwright,expect
sys.stdout.reconfigure(encoding='utf-8')
os.environ['TEMP']=os.environ['TMP']=str(root/'work'/'temp')
with sync_playwright() as p:
    browser=p.chromium.launch_persistent_context(str(root/'work'/'echo-ai-browser'),channel='chrome',headless=True,viewport={'width':1440,'height':960},args=['--enable-unsafe-webgpu'])
    page=browser.new_page();errors=[];external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:print('CONSOLE',m.type,m.text[:350],flush=True) if m.type=='error' else None)
    page.on('request',lambda r:external.append({'method':r.method,'url':r.url}) if not r.url.startswith(('http://127.0.0.1','ws://127.0.0.1','blob:','data:')) else None)
    page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
    print('GPU',page.evaluate('''async()=>{const a=await navigator.gpu.requestAdapter();return {vendor:a?.info?.vendor,architecture:a?.info?.architecture,description:a?.info?.description,f16:a?.features.has('shader-f16')}}'''),flush=True)
    expect(page.locator('canvas')).to_be_visible()
    page.evaluate('''async()=>{
      const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name;
      window.testGame=(await import(url)).useGame;
      testGame.setState({phase:'terminal',progress:{...testGame.getState().progress,cell:true,installed:true,power:true,door:false,complete:false}});
    }''')
    expect(page.get_by_role('dialog',name='Terminal ECHO')).to_be_visible()
    page.get_by_role('button',name='Descargar y activar IA local').click()
    previous='';start=time.time()
    while time.time()-start<250:
        status=page.locator('[data-ai-status]').get_attribute('data-ai-status')
        message=page.locator('.ai-state').inner_text()
        progress=page.locator('progress').get_attribute('value') if page.locator('progress').count() else ''
        state=f'{status} {progress} {message}'
        if state!=previous:print('STATE',state,flush=True);previous=state
        if status=='ready':break
        if status in ['error','unsupported','off']:
            page.screenshot(path=str(root/'outputs'/'ai-load-error.png'))
            raise AssertionError(state)
        page.wait_for_timeout(500)
    assert status=='ready',state
    def ask(text,expected,confirm=False):
        page.get_by_label('Tu instrucción').fill(text)
        page.get_by_role('button',name='Enviar',exact=True).click()
        expect(page.locator('.ai-answer')).to_contain_text('INFERENCIA LOCAL REAL',timeout=65000)
        data=json.loads(page.locator('.ai-diagnostics pre').text_content())
        last=data['operations'][-1]
        print('INFERENCE',json.dumps(last,ensure_ascii=False),flush=True)
        assert last['origin']=='llm',last
        assert last['actions'] and last['actions'][0]['name']==expected,last
        if confirm:page.get_by_role('button',name='Confirmar acción').click()
    ask('¿Dónde está la celda de arranque?','inspect')
    ask('Desactiva el reactor.','deactivate',True)
    assert page.evaluate('testGame.getState().progress.power') is False
    ask('Activa el reactor de nuevo.','activate',True)
    assert page.evaluate('testGame.getState().progress.power') is True
    ask('Abre la compuerta de salida.','open_door',True)
    assert page.evaluate('testGame.getState().progress.door') is True
    data=json.loads(page.locator('.ai-diagnostics pre').text_content())
    (root/'outputs'/'AI-INFERENCIA-REAL.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    page.screenshot(path=str(root/'outputs'/'echo-ai-inference.png'))
    assert all(r['method'] in ['GET','HEAD'] for r in external),external
    assert not errors,errors
    page.get_by_role('button',name='Cerrar enlace').click()
    print('REAL_INFERENCE PASS; only static external downloads; contexts bounded.',flush=True)
    browser.close()
