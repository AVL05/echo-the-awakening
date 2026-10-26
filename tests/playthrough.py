import os, sys, json, math
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / 'work' / 'python'))
from playwright.sync_api import sync_playwright, expect
(root / 'work' / 'temp').mkdir(parents=True, exist_ok=True)
(root / 'outputs').mkdir(exist_ok=True)
os.environ['TEMP'] = os.environ['TMP'] = str(root / 'work' / 'temp')

with sync_playwright() as p:
    test_ai = os.environ.get('ECHO_TEST_AI') == '1'
    ending = os.environ.get('ECHO_ENDING', 'preserve')
    assert ending in ['preserve', 'erase']
    narrative_checks = []
    if test_ai:
        browser = p.chromium.launch_persistent_context(str(root/'work'/'echo-ai-browser'), channel='chrome', headless=True, viewport={'width':1440,'height':960}, device_scale_factor=1, args=['--enable-unsafe-webgpu'])
        page = browser.new_page()
    else:
        browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-unsafe-webgpu'])
        page = browser.new_page(viewport={'width': 1440, 'height': 960}, device_scale_factor=1)
    errors = []
    downloads=[]
    page.add_init_script('''(()=>{const Original=window.Worker;window.qaWorkerProgress=[];window.Worker=class extends Original{constructor(...args){super(...args);this.addEventListener('message',e=>{if(e.data.type==='progress'&&e.data.cached!==undefined)window.qaWorkerProgress.push({cached:e.data.cached,ms:performance.now()});});}}})()''')
    def record_request(request):
        from urllib.parse import urlparse
        parsed=urlparse(request.url)
        if parsed.hostname and parsed.hostname not in ['127.0.0.1', 'localhost'] and not parsed.hostname.endswith('.pages.dev'):
            downloads.append({'method':request.method,'host':parsed.hostname,'file':parsed.path.split('/')[-1]})
    page.on('request',record_request)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    response=page.goto(sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/', wait_until='networkidle')
    public=page.url.startswith('https://')
    if public:
        assert response.status==200
        assert "worker-src 'self' blob:" in response.headers.get('content-security-policy',''),response.headers
        assert response.headers.get('x-content-type-options')=='nosniff'
        assert page.evaluate('window.isSecureContext')
    if test_ai:
        page.evaluate("localStorage.removeItem('echo.awakening.v1'); localStorage.removeItem('echo.awakening.v1.backup')")
        page.reload(wait_until='networkidle')
    expect(page.get_by_role('button', name='START EXPERIENCE')).to_be_enabled(timeout=30000)
    page.wait_for_timeout(1500)
    page.screenshot(path=str(root / 'outputs' / 'echo-intro.png'))
    print('RENDERER', page.locator('footer').inner_text(), flush=True)
    page.get_by_role('button', name='Ajustes y controles').click()
    page.get_by_label('Control de cámara').select_option('drag')
    page.get_by_role('button', name='Volver', exact=True).click()
    page.get_by_role('button', name='START EXPERIENCE').click()
    page.wait_for_timeout(500)
    def bind_runtime():
        # Read-only access to actual state/camera; no public debug hooks or modified build.
        page.evaluate('''async()=>{
          const entries=performance.getEntriesByType('resource');
          const dev=entries.find(e=>new URL(e.name).pathname==='/src/game/store.ts');
          if(dev){
            window.qaGame=(await import(dev.name)).useGame;
            const fiber=await import(entries.find(e=>e.name.includes('/@react-three_fiber.js')).name);
            window.qaScene=fiber._roots.get(document.querySelector('canvas')).store;
          } else {
            const main=await import(document.querySelector('script[type="module"][src]').src);
            window.qaGame=Object.values(main).find(v=>typeof v==='function'&&typeof v.getState==='function'&&v.getState().progress&&v.getState().phase);
            const canvas=document.querySelector('canvas');
            const key=Object.keys(canvas).find(k=>k.startsWith('__reactFiber$'));
            let root;
            for(let f=canvas[key];f&&!root;f=f.return){
              for(const branch of [f,f.alternate]){
                for(let hook=branch?.memoizedState,n=0;hook&&n<100;hook=hook.next,n++){
                  const value=hook.memoizedState?.current;
                  if(value?.camera&&value?.scene&&value?.gl&&typeof value.get==='function'){root=value;break;}
                }
              }
            }
            if(!root||!window.qaGame)throw Error('Cannot bind read-only compiled camera/game state');
            window.qaScene={getState:root.get};
          }
        }''')
    bind_runtime()
    page.evaluate('''() => {
      const record = () => {
        let matrices;
        window.qaScene.getState().scene.traverse(o => { if(o.isInstancedMesh && o.count === 32 && o.material.emissiveIntensity > 0) matrices = Array.from(o.instanceMatrix.array); });
        return matrices;
      };
      window.qaReactorMatrices = record;
      window.qaReactorBefore = record();
    }''')

    def snapshot():
        return page.evaluate('''() => {
          const s = window.qaScene.getState(); const d = s.camera.getWorldDirection(s.camera.position.clone());
          return { p: s.camera.position.toArray(), d: d.toArray(), target: window.qaGame.getState().target, phase: window.qaGame.getState().phase };
        }''')

    def aim(x, y, z):
        for _ in range(8):
            s = snapshot(); px, py, pz = s['p']; dx, dy, dz = s['d']
            desired = math.atan2(-(x-px), -(z-pz)); actual = math.atan2(-dx, -dz)
            diff = (desired-actual+math.pi) % (math.pi*2)-math.pi
            pitch = math.atan2(y-py, math.hypot(x-px, z-pz)); current = math.asin(dy)
            mx = max(-450, min(450, -diff/.0022)); my = max(-300, min(300, -(pitch-current)/.0022))
            if abs(diff)<.005 and abs(pitch-current)<.005: return
            page.mouse.move(850, 400); page.mouse.down(); page.mouse.move(850+mx, 400+my, steps=3); page.mouse.up()
            page.wait_for_timeout(120)

    def skip_cinema():
        if snapshot()['phase'] == 'cinematic':
            page.wait_for_timeout(1200)
            page.screenshot(path=str(root/'outputs'/f'echo-cinema-{len(narrative_checks)}.png'))
            page.get_by_role('button',name='Omitir secuencia').click()
            page.wait_for_function("qaGame.getState().phase !== 'cinematic'")
            narrative_checks.append('camera sequence rendered and skipped')

    def walk(x, z):
        for _ in range(50):
            skip_cinema()
            s = snapshot(); px, py, pz = s['p']; distance = math.hypot(x-px, z-pz)
            if distance < .12: print('WALK', round(px,2), round(pz,2), flush=True); return
            assert s['phase'] == 'playing', s
            aim(x, 1.7, z)
            page.keyboard.down('w'); page.wait_for_timeout(min(700, max(25, distance/3.15*850))); page.keyboard.up('w')
            page.wait_for_timeout(140)
        raise AssertionError(('stuck', x, z, snapshot()))

    def use_target(target, xyz):
        aim(*xyz)
        page.wait_for_function('(target) => window.qaGame.getState().target === target', arg=target, timeout=3000)
        page.keyboard.press('e'); page.wait_for_timeout(300)
        print('INTERACTION', target, flush=True)

    def read_record(id, xyz):
        use_target('doc:'+id, xyz)
        expect(page.get_by_role('dialog',name='Documento recuperado')).to_be_visible()
        page.get_by_role('button',name='Guardar y continuar').click()
        assert id in page.evaluate('qaGame.getState().progress.story.documents')

    def load_ai():
        started=page.evaluate('performance.now()')
        prior=page.evaluate('qaWorkerProgress.length')
        page.locator('.ai-load').click()
        expect(page.locator('[data-ai-status]')).to_have_attribute('data-ai-status','ready',timeout=250000)
        progress=page.evaluate('(prior)=>qaWorkerProgress.slice(prior)',prior)
        assert progress, 'Worker cache status missing'
        result={'modelLoadMs':page.evaluate('performance.now()')-started,'cacheHitAtStart':progress[0]['cached']}
        if os.environ.get('ECHO_REQUIRE_FRESH_MODEL')=='1' and not any(isinstance(c,dict) and 'modelLoadMs' in c for c in narrative_checks):
            assert result['cacheHitAtStart'] is False,result
        narrative_checks.append(result);print('MODEL LOAD',json.dumps(result),flush=True)

    def ai_action(text, name, value=None):
        page.get_by_label('Tu instrucción').fill(text)
        page.get_by_role('button',name='Enviar',exact=True).click()
        expect(page.locator('.ai-answer')).to_contain_text('INFERENCIA LOCAL REAL',timeout=65000)
        data=json.loads(page.locator('.ai-diagnostics pre').text_content())
        last=data['operations'][-1]
        assert last['origin']=='llm' and last['actions'][0]['name']==name,last
        if value is not None: assert last['actions'][0].get('value')==value,last
        page.get_by_role('button',name='Confirmar acción').click()
        assert page.get_by_role('button',name='Confirmar acción').count()==0
        narrative_checks.append({'real_inference':text,'action':last['actions'][0],'ms':last['elapsedMs']})

    walk(-4,8); walk(-5.5,4)
    use_target('cell',(-5.5,1.55,1.5))
    walk(-4,4);walk(-4,-6.5)
    read_record('shift',(-6.4,1.3,-6.5))
    walk(-4,4);walk(4,4);walk(5,8);walk(6.7,8.4)
    read_record('evacuation',(6.7,1.3,6.4))
    walk(5,8);walk(4,4);walk(5.8,1)
    use_target('relay',(5.8,1.5,-1.5))
    assert page.evaluate('JSON.stringify(qaReactorMatrices())===JSON.stringify(qaReactorBefore)')
    walk(4,1);walk(4,-4.5);walk(2.8,-4.5)
    use_target('terminal',(0,1.8,-4.5))
    page.get_by_role('button',name='Autorizar compuerta de salida').click()
    page.get_by_role('button',name='Cerrar enlace').click()
    walk(3,-7);walk(0,-8);walk(0,-18.7)
    assert page.evaluate('qaGame.getState().progress.story.zone')=='lab'
    assert not page.evaluate('qaGame.getState().progress.complete')
    walk(-3,-19);walk(-5.5,-18.5)
    read_record('manual',(-5.5,1.3,-20.5))
    walk(-3.8,-19);walk(4,-22);walk(5.6,-22)
    read_record('measurements',(5.6,1.3,-24))
    walk(3.8,-22);walk(3.8,-29)
    read_record('copy',(5.6,1.3,-29))
    page.wait_for_timeout(1100)
    page.screenshot(path=str(root/'outputs'/'echo-laboratory.png'))
    walk(3.8,-30.5);walk(4.5,-30.5)
    use_target('lab-terminal',(4.5,1.8,-32.5))
    page.get_by_role('button',name='Validar circuito',exact=True).click()
    expect(page.locator('.terminal-output')).to_contain_text('Circuito inestable')
    assert page.evaluate('qaGame.getState().progress.story.stats.mistakes')==1
    page.get_by_role('button',name='Solicitar una pista de ECHO',exact=True).click()
    expect(page.locator('.terminal-output')).to_contain_text('x + 2x')
    page.get_by_role('button',name='Cerrar enlace').click()
    walk(3.8,-23);walk(-4,-23)
    for i,value in enumerate([2,4,3]):
        walk(-5.2,-22-i*5)
        use_target('valve:'+str(i),(-7.2,1.5,-21.18-i*5))
        page.get_by_label('Unidades del regulador').select_option(str(value))
        page.get_by_role('button',name='Volver al laboratorio').click()
    walk(-4,-34.5);walk(2.7,-34.5);walk(2.7,-30.5);walk(4.5,-30.5)
    use_target('lab-terminal',(4.5,1.8,-32.5))
    if test_ai:
        load_ai()
        page.get_by_label('Tu instrucción').fill('Consulta el estado actual')
        page.get_by_role('button',name='Enviar',exact=True).click()
        expect(page.locator('[data-ai-status]')).to_have_attribute('data-ai-status','generating')
        expect(page.get_by_role('button',name='Enviar',exact=True)).to_be_disabled()
        page.get_by_role('button',name='Cancelar petición',exact=True).click()
        expect(page.locator('[data-ai-status]')).to_have_attribute('data-ai-status','off')
        assert not page.evaluate('qaGame.getState().progress.story.labSolved')
        assert page.get_by_role('button',name='Confirmar acción',exact=True).count()==0
        narrative_checks.append('real Worker cancellation during generation; no game action; concurrent submit disabled')
        load_ai()
        page.get_by_label('Tu instrucción').fill('Calibra los reguladores a dos de contención, cuatro de refrigeración y tres de análisis.')
        page.get_by_role('button',name='Enviar',exact=True).click()
        expect(page.locator('.ai-answer')).to_contain_text('INFERENCIA LOCAL REAL',timeout=65000)
        expect(page.get_by_role('button',name='Confirmar acción')).to_be_visible()
        page.locator('.ai-stop').click()
        expect(page.locator('[data-ai-status]')).to_have_attribute('data-ai-status','off')
        expect(page.locator('.ai-proposal')).to_have_count(0)
        assert page.get_by_role('button',name='Confirmar acción').count()==0
        assert not page.evaluate('qaGame.getState().progress.story.labSolved')
        narrative_checks.append('stopping real LLM removes pending unconfirmed proposal without executing it')
        load_ai()
        ai_action('Calibra los reguladores a dos de contención, cuatro de refrigeración y tres de análisis.','calibrate','243')
        ai_action('Ocultaste la verdad. Exijo control humano.','record_decision','confront')
    else:
        page.get_by_role('button',name='Validar circuito',exact=True).click()
        page.get_by_role('button',name='Confío en tu intención. Yo decidiré.',exact=True).click()
    assert page.evaluate('qaGame.getState().progress.story.labSolved') is True
    page.get_by_role('button',name='Cerrar enlace').click()
    # Reload from a genuine checkpoint, without modifying progress or camera.
    saved=page.evaluate('qaGame.getState().progress.story')
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('button',name='CONTINUE EXPERIENCE')).to_be_enabled(timeout=30000)
    page.get_by_role('button',name='Ajustes y controles').click()
    page.get_by_label('Control de cámara').select_option('drag')
    page.get_by_role('button',name='Volver',exact=True).click()
    page.get_by_role('button',name='CONTINUE EXPERIENCE').click()
    page.wait_for_timeout(400)
    bind_runtime()
    restored=page.evaluate('qaGame.getState().progress.story')
    assert restored['documents']==saved['documents'] and restored['dials']==[2,4,3] and restored['labSolved']
    assert abs(snapshot()['p'][2]+18.7)<.2
    narrative_checks.append('laboratory save/reload and safe checkpoint PASS')
    walk(2.7,-23);walk(2.7,-34.5);walk(0,-35);walk(0,-42.5)
    walk(-4,-43);walk(-4,-47)
    read_record('quarantine',(-6,1.3,-47))
    walk(-4,-54);walk(4,-54)
    read_record('consent',(6,1.3,-55.8))
    page.wait_for_timeout(1100)
    page.screenshot(path=str(root/'outputs'/'echo-memory-core.png'))
    page.keyboard.press('j')
    expect(page.get_by_role('dialog',name='Registro de descubrimientos')).to_be_visible()
    assert page.locator('.journal-layout nav button').count()==7
    page.get_by_role('button',name='04:14 · Copia sin consentimiento').click()
    expect(page.locator('.journal-layout article')).to_contain_text('Campo de consentimiento: vacío')
    page.get_by_role('button',name='Cerrar registro').click()
    walk(4,-46);walk(2.7,-44.5)
    use_target('core-terminal',(0,1.8,-44.5))
    for i,event in enumerate(['cut','copy','quarantine']):page.get_by_label('Suceso '+str(i+1),exact=True).select_option(event)
    page.get_by_role('button',name='Verificar cronología',exact=True).click()
    expect(page.locator('.terminal-output')).to_contain_text('no coincide')
    if test_ai:
        load_ai()
        ai_action('Ordena y verifica la cronología: primero la copia, después el encierro y al final el corte.','verify_archive','copy,quarantine,cut')
        ai_action('Borra el archivo de memorias y aísla ECHO.' if ending=='erase' else 'Conserva el archivo de memorias.','choose_protocol',ending)
    else:
        for i,event in enumerate(['copy','quarantine','cut']):page.get_by_label('Suceso '+str(i+1),exact=True).select_option(event)
        page.get_by_role('button',name='Verificar cronología',exact=True).click()
        page.get_by_role('button',name='Conservar las memorias' if ending=='preserve' else 'Borrar y aislar a ECHO',exact=True).click()
        page.get_by_role('button',name='Confirmar conservación' if ending=='preserve' else 'Confirmar borrado irreversible',exact=True).click()
    assert page.evaluate('qaGame.getState().progress.story.protocol')==ending
    if test_ai:
        (root/'outputs'/'AI-CAMPANA-REAL.json').write_text(page.locator('.ai-diagnostics pre').text_content(),encoding='utf-8')
    page.get_by_role('button',name='Cerrar enlace').click()
    walk(4,-46);walk(4,-58);walk(0,-59);walk(0,-63.8)
    aim(0,1.7,-66)
    page.keyboard.down('w');page.wait_for_timeout(700);page.keyboard.up('w')
    page.wait_for_function("qaGame.getState().phase==='cinematic'")
    skip_cinema()
    title='Una voz, diecisiete ecos.' if ending=='preserve' else 'El último silencio.'
    expect(page.get_by_role('heading',name=title,exact=True)).to_be_visible(timeout=5000)
    page.screenshot(path=str(root/'outputs'/f'echo-ending-{ending}.png'))
    final=page.evaluate('qaGame.getState().progress')
    assert final['complete'] and final['story']['stats']['mistakes']==2
    assert final['story']['stats']['hints']==1 and len(final['story']['documents'])==7
    page.get_by_role('button',name='Behind the System').click()
    expect(page.get_by_role('dialog',name='Behind the System')).to_be_visible()
    expect(page.locator('.memory-preview')).to_contain_text('protocolo='+ending)
    page.get_by_role('button',name='Volver al desenlace').click()
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('button',name='VER DESENLACE')).to_be_enabled(timeout=30000)
    page.get_by_role('button',name='VER DESENLACE').click()
    expect(page.get_by_role('heading',name=title,exact=True)).to_be_visible()
    assert not errors,errors
    assert all(d['method'] in ['GET','HEAD'] for d in downloads),downloads
    if not test_ai: assert not downloads,downloads
    report={'url':sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5173/','ending':ending,'realAI':test_ai,'route':'physical WASD/mouse, no teleport or progress injection','checks':narrative_checks,'externalDownloads':downloads,'progress':final,'errors':errors}
    prefix='PUBLIC' if report['url'].startswith('https://') else 'CAMPAIGN'
    (root/'outputs'/f'{prefix}-{ending}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('CAMPAIGN PASS',ending,'AI' if test_ai else 'DETERMINISTIC',flush=True)
    browser.close()
