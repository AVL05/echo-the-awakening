import os, sys, json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root/'work'/'python'))
from playwright.sync_api import sync_playwright, expect
sys.stdout.reconfigure(encoding='utf-8')
(root/'work'/'temp').mkdir(parents=True,exist_ok=True)
os.environ['TEMP'] = os.environ['TMP'] = str(root/'work'/'temp')
with sync_playwright() as p:
    executable=os.environ.get('ECHO_BROWSER_PATH')
    browser=p.chromium.launch(**({'executable_path':executable} if executable else {'channel':'chrome'}),headless=True,args=['--enable-unsafe-webgpu'])
    print('BROWSER_VERSION',browser.version,flush=True)
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' or (m.type=='warning' and 'Material: parameter' in m.text) else None)
    url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4173/'
    csp=next(line.strip().split(':',1)[1].strip() for line in (root/'public'/'_headers').read_text(encoding='utf-8').splitlines() if line.strip().startswith('Content-Security-Policy:'))
    def production_headers(route):
        response=route.fetch()
        route.fulfill(response=response,headers={**response.headers,'Content-Security-Policy':csp})
    if url.startswith('http://127.0.0.1:'):page.route(url,production_headers)
    page.goto(url,wait_until='networkidle')
    print('GPU_HIGH_PERFORMANCE',page.evaluate('''async()=>{const a=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});return {vendor:a?.info?.vendor,architecture:a?.info?.architecture,f16:a?.features.has('shader-f16')}}'''),flush=True)
    expect(page.get_by_role('button',name='START EXPERIENCE')).to_be_enabled(timeout=20000)
    renderer=page.locator('footer').inner_text().replace('\n',' | ')
    assert 'WEBGPU' in renderer or 'WEBGL 2' in renderer,renderer
    print('ACTIVE_RENDERER',renderer,flush=True)
    page.get_by_role('button',name='START EXPERIENCE').click()
    expect(page.get_by_label('Objetivo actual')).to_be_visible()
    page.wait_for_timeout(500)
    print('POINTER_LOCK',page.evaluate('document.pointerLockElement?.tagName ?? null'),flush=True)
    page.keyboard.press('Escape')
    page.wait_for_timeout(500)
    expect(page.get_by_role('dialog')).to_be_visible()
    page.get_by_role('button',name='Reanudar experiencia').click()
    expect(page.get_by_label('Mensaje ECHO')).to_be_visible()
    page.wait_for_timeout(300)
    assert page.request.get(url.rstrip('/')+'/THIRD_PARTY_NOTICES.txt').status==200
    assert not errors,errors
    page.keyboard.press('Escape')
    page.get_by_role('button',name='Behind the System').click()
    expect(page.locator('.architecture-node')).to_have_count(8)
    page.get_by_role('tab',name='Eventos reales').click()
    page.get_by_role('button',name='Consultar estado real',exact=True).click()
    expect(page.locator('.event-detail')).to_contain_text('Consulta real de solo lectura')
    page.get_by_role('button',name='Volver a la pausa',exact=True).click()
    assert not errors,errors
    print('PRODUCTION_SMOKE PASS',json.dumps(errors),flush=True)
    browser.close()
