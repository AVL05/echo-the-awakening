"""Compiled build only. Apply the configured Pages headers locally; this is NOT public HTTPS QA."""
import os, sys, json, fnmatch
from pathlib import Path
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root/'work'/'python'))
from playwright.sync_api import sync_playwright, expect
sys.stdout.reconfigure(encoding='utf-8')
os.environ['TEMP'] = os.environ['TMP'] = str(root/'work'/'temp')
base = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4173'
label = sys.argv[2] if len(sys.argv)>2 else 'after'
rules = []
for line in (root/'dist'/'_headers').read_text(encoding='utf-8').splitlines():
    if line.startswith('/'):
        rules.append((line, {}))
    elif line.startswith('  ') and ':' in line:
        key, value = line.strip().split(':', 1); rules[-1][1][key] = value.strip()

results=[]
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-unsafe-webgpu'])
    for name, query in [('webgpu',''), ('webgl-forced','?renderer=webgl'), ('webgl-auto','')]:
        context = browser.new_context(viewport={'width':1440,'height':900})
        def local_headers(route):
            response = route.fetch(); headers = dict(response.headers)
            path = route.request.url.split(base,1)[1].split('?',1)[0] or '/'
            for pattern, values in rules:
                if fnmatch.fnmatchcase(path, pattern): headers.update(values)
            route.fulfill(response=response, headers=headers)
        if base.startswith('http://127.0.0.1:'):
            context.route(base+'/**', local_headers)
        page=context.new_page();errors=[];external=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type=='error' else None)
        page.on('request', lambda r: external.append(r.url) if not r.url.startswith((base,'blob:','data:')) else None)
        if name=='webgl-auto': page.add_init_script("Object.defineProperty(navigator,'gpu',{get:()=>undefined})")
        cdp=context.new_cdp_session(page);cdp.send('Network.enable');cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
        page.goto(base+'/'+query,wait_until='networkidle')
        expect(page.get_by_role('button',name='START EXPERIENCE')).to_be_enabled(timeout=30000)
        expect(page.locator('footer')).to_contain_text('WEBGPU' if name=='webgpu' else 'WEBGL 2')
        resources=page.evaluate("performance.getEntriesByType('resource').filter(r=>/\\.js($|\\?)/.test(r.name)).map(r=>({path:new URL(r.name).pathname,bytes:r.decodedBodySize,duration:r.duration}))")
        assert not any('echo.worker' in r['path'] for r in resources),'Model Worker downloaded before consent'
        if name!='webgpu' and label!='before':
            assert not any('three.webgpu' in r['path'] or '/energy-' in r['path'] for r in resources),resources
        assert not external,external
        before=page.evaluate('performance.now()')
        page.get_by_role('button',name='Behind the System',exact=False).click()
        expect(page.locator('.architecture-node')).to_have_count(8)
        page.get_by_role('tab',name='Eventos reales').click()
        page.get_by_role('button',name='Consultar estado real',exact=True).click()
        expect(page.locator('.event-detail')).to_contain_text('Consulta real de solo lectura')
        page.get_by_role('button',name='Volver al inicio',exact=True).click()
        heaps=[]
        if name=='webgpu':
            for _ in range(8):
                page.get_by_role('button',name='Behind the System',exact=False).click()
                page.get_by_role('tab',name='Eventos reales').click()
                page.get_by_role('button',name='Consultar estado real',exact=True).click()
                page.get_by_role('button',name='Volver al inicio',exact=True).click()
                cdp.send('HeapProfiler.collectGarbage');heaps.append(cdp.send('Runtime.getHeapUsage')['usedSize'])
            assert max(heaps[-4:])-min(heaps[-4:])<2*1024*1024,heaps
        page.get_by_role('button',name='Ajustes y controles').click()
        page.get_by_label('Control de cámara').select_option('drag')
        page.get_by_role('button',name='Volver',exact=True).click()
        page.get_by_role('button',name='START EXPERIENCE').click()
        expect(page.get_by_label('Objetivo actual')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog')).to_be_visible()
        page.get_by_role('button',name='Reanudar experiencia').click()
        expect(page.get_by_label('Mensaje ECHO')).to_be_visible()
        assert not errors,errors
        result={'case':name,'status':'PASS','initialJsBytes':sum(r['bytes'] for r in resources),'initialScripts':resources,'heapAfterGC':heaps,'errors':errors,'externalBeforeConsent':external}
        results.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
        context.close()
    browser.close()
(root/'outputs'/f'PRODUCTION-GATE-{label}.json').write_text(json.dumps({'url':base,'scope':'Actual public HTTPS; no response interception' if base.startswith('https://') else 'localhost compiled build + configured Pages headers; not public HTTPS','results':results},ensure_ascii=False,indent=2),encoding='utf-8')
