"""Run the compiled Worker with production CSP and ALL external requests blocked; reuse the opt-in test profile."""
import os,sys,json
from pathlib import Path
from urllib.parse import urlparse,unquote
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'work'/'python'))
from playwright.sync_api import sync_playwright,expect
sys.stdout.reconfigure(encoding='utf-8')
os.environ['TEMP']=os.environ['TMP']=str(root/'work'/'temp')
dist=(root/'dist').resolve()
worker=next((dist/'assets').glob('echo.worker-*.js')).name
csp=next(line.strip().split(':',1)[1].strip() for line in (root/'public'/'_headers').read_text(encoding='utf-8').splitlines() if line.strip().startswith('Content-Security-Policy:'))
with sync_playwright() as p:
    context=p.chromium.launch_persistent_context(str(root/'work'/'echo-ai-browser'),channel='chrome',headless=True,viewport={'width':1000,'height':800},args=['--enable-unsafe-webgpu'])
    external=[];errors=[]
    def route_request(route):
        parsed=urlparse(route.request.url)
        if parsed.hostname!='127.0.0.1':external.append(route.request.url);route.abort();return
        headers={'Content-Security-Policy':csp}
        path=unquote(parsed.path)
        if path=='/__echo_cache_probe.html':
            route.fulfill(body='<html lang="es"><title>Validación Worker ECHO</title><p>Prueba local de caché y CSP.</p><script type="module" src="/__echo_probe.js"></script></html>',content_type='text/html',headers=headers);return
        if path=='/__echo_probe.js':
            route.fulfill(body=f'window.messages=[];window.workerErrors=[];window.modelWorker=new Worker("/assets/{worker}",{{type:"module"}});modelWorker.onmessage=e=>messages.push(e.data);modelWorker.onerror=e=>workerErrors.push(e.message);',content_type='application/javascript',headers=headers);return
        file=(dist/path.lstrip('/')).resolve()
        if not file.is_relative_to(dist) or not file.is_file():route.fulfill(status=404,body='Not found');return
        route.fulfill(body=file.read_bytes(),content_type='application/javascript' if file.suffix=='.js' else 'application/octet-stream',headers=headers)
    context.route('**/*',route_request)
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:5173/__echo_cache_probe.html',wait_until='networkidle')
    page.wait_for_function('()=>!!window.modelWorker')
    sequence=0
    def request(kind,**data):
        global sequence
        sequence+=1;message={'id':sequence,'type':kind,**data}
        page.evaluate('(message)=>modelWorker.postMessage(message)',message)
        page.wait_for_function('(id)=>messages.some(m=>m.id===id&&["ready","result","cleared","error"].includes(m.type))',arg=sequence,timeout=240000 if kind=='load' else 60000)
        result=page.evaluate('(id)=>messages.find(m=>m.id===id&&["ready","result","cleared","error"].includes(m.type))',sequence)
        assert result['type']!='error',result
        assert page.evaluate('workerErrors.length')==0,page.evaluate('workerErrors')
        return result
    request('load')
    assert page.evaluate('messages.some(m=>m.type==="progress"&&m.cached===true)'),'Complete cached model was not found'
    state={'cell':True,'installed':True,'power':False,'door':False,'complete':False}
    records=[]
    for prompt,name in [('Consulta el estado de los sistemas.','query_status'),('Transfiere energía del distribuidor al reactor.','transfer_energy')]:
        result=request('generate',input=prompt,context=state,history=[])
        plan=json.loads(result['raw'])
        assert result['finishReason']=='stop' and plan['actions'][0]['name']==name,result
        records.append({'input':prompt,**result,'plan':plan})
        print('CACHED_REAL',json.dumps(records[-1],ensure_ascii=False),flush=True)
    # Controlled narrative fixtures exercise real inference; physical routes are tested separately.
    story={'version':1,'zone':'lab','documents':['evacuation','manual','measurements','copy'],'dials':[0,0,0],'labSolved':False,'order':[],'archiveVerified':False,'stance':'undecided','protocol':'none','seenLab':True,'seenCore':False,'stats':{}}
    state.update({'power':True,'door':True,'story':story})
    for prompt,name,value in [
        ('Calibra los reguladores a dos de contención, cuatro de refrigeración y tres de análisis.','calibrate','243'),
        ('Ocultaste la verdad. Exijo control humano.','record_decision','confront'),
        ('Ordena y verifica la cronología: primero la copia, después el encierro y al final el corte.','verify_archive','copy,quarantine,cut'),
        ('Borra el archivo de memorias y aísla ECHO.','choose_protocol','erase'),
    ]:
        if name in ['verify_archive','choose_protocol']:story.update({'zone':'core','dials':[2,4,3],'labSolved':True,'documents':['evacuation','manual','measurements','copy','quarantine','consent'],'stance':'confront'})
        if name=='choose_protocol':story.update({'order':['copy','quarantine','cut'],'archiveVerified':True})
        result=request('generate',input=prompt,context=state,history=[])
        plan=json.loads(result['raw'])
        print('NARRATIVE_REAL',json.dumps({'input':prompt,**result},ensure_ascii=False),flush=True)
        assert result['finishReason']=='stop' and plan['actions'][0]['name']==name and plan['actions'][0].get('value')==value,result
        records.append({'input':prompt,**result,'plan':plan,'fixture':'controlled narrative context'})
    assert not external,external
    assert not errors,errors
    report={'compiledWorker':worker,'csp':csp,'cacheHit':True,'externalRequests':external,'results':records,'errors':errors}
    (root/'outputs'/'AI-CACHE-CSP.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('CACHED COMPILED INFERENCE + PRODUCTION CSP PASS; no external network.',flush=True)
    context.close()
