import os, sys, json
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / 'work' / 'python'))
from playwright.sync_api import sync_playwright, expect
(root / 'work' / 'temp').mkdir(parents=True, exist_ok=True)
(root / 'outputs').mkdir(exist_ok=True)
os.environ['TEMP'] = os.environ['TMP'] = str(root / 'work' / 'temp')
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-unsafe-webgpu'])
    for name, query, init in [
        ('forced-webgl', '?renderer=webgl', ''),
        ('auto-fallback', '', "Object.defineProperty(navigator, 'gpu', {get: () => undefined})"),
        ('storage-denied', '', "Storage.prototype.getItem = () => { throw new DOMException('Denied','SecurityError') }; Storage.prototype.setItem = () => { throw new DOMException('Denied','SecurityError') }"),
    ]:
        print('CASE',name,flush=True)
        page = browser.new_page(viewport={'width':1440, 'height':900})
        page.set_default_timeout(15000)
        errors=[]; requests=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        page.on('request', lambda r: requests.append(r.url))
        if init: page.add_init_script(init)
        page.goto('http://127.0.0.1:5173/'+query, wait_until='networkidle')
        start = page.get_by_role('button', name='START EXPERIENCE')
        expect(start).to_be_enabled(timeout=20000)
        page.wait_for_timeout(1300)
        page.screenshot(path=str(root/'outputs'/f'echo-{name}.png'))
        if name != 'storage-denied': expect(page.locator('footer')).to_contain_text('WEBGL 2')
        page.get_by_role('button', name='Ajustes y controles').click()
        print(name,'settings',flush=True)
        page.get_by_label('Control de cámara').select_option('drag')
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog')).to_have_count(0)
        start.click()
        page.wait_for_timeout(350)
        expect(page.get_by_label('Objetivo actual')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog')).to_be_visible()
        page.get_by_label('Calidad gráfica').select_option('low')
        print(name,'low quality',flush=True)
        page.get_by_role('button',name='Reanudar experiencia').click()
        expect(page.locator('footer')).to_contain_text('RENDIMIENTO')
        page.wait_for_timeout(300)
        if name == 'storage-denied':
            # Test the actual storage error handling, independently of walking the puzzle again.
            page.evaluate("async () => { const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name; const {useGame} = await import(url); useGame.getState().save({...useGame.getState().progress,cell:true}) }")
            expect(page.get_by_role('status')).to_contain_text('Guardado local no disponible')
        assert not errors, errors
        assert not [r for r in requests if not r.startswith(('http://127.0.0.1:5173','ws://127.0.0.1:5173','data:','blob:'))], requests
        results.append({'case':name,'status':'PASS','errors':errors})
        page.close()
        print(name,'PASS',flush=True)

    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, device_scale_factor=1, reduced_motion='reduce')
    page = context.new_page(); errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:5173/?renderer=webgl',wait_until='networkidle')
    expect(page.get_by_role('button',name='START EXPERIENCE')).to_be_enabled(timeout=20000)
    page.wait_for_timeout(500)
    page.screenshot(path=str(root/'outputs'/'echo-mobile-intro.png'))
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.get_by_role('button',name='START EXPERIENCE').tap()
    expect(page.get_by_role('button',name='Avanzar')).to_be_visible()
    page.wait_for_timeout(300)
    # Two real touch contacts: walking must continue while the other finger turns the camera.
    page.evaluate('''async()=>{
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/@react-three_fiber.js')).name;
      const fiber=await import(url); window.mobileRoot=fiber._roots.get(document.querySelector('canvas')).store;
    }''')
    def pose():
        return page.evaluate('''()=>{const c=mobileRoot.getState().camera;return {p:c.position.toArray(),d:c.getWorldDirection(c.position.clone()).toArray()}}''')
    before=pose()
    # Tutorial text must not intercept the camera gesture; its dismiss button remains usable.
    assert page.evaluate("document.elementFromPoint(310,340).tagName==='CANVAS'"),page.evaluate("document.elementFromPoint(310,340).outerHTML")
    up=page.get_by_role('button',name='Avanzar').bounding_box()
    contact={'x':up['x']+up['width']/2,'y':up['y']+up['height']/2,'id':1}
    session=context.new_cdp_session(page)
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[contact]})
    page.wait_for_timeout(450)
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[contact,{'x':310,'y':340,'id':2}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[contact,{'x':250,'y':340,'id':2}]})
    page.wait_for_timeout(350)
    session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    after=pose()
    assert after['p'][2]<before['p'][2]-.15,(before,after)
    assert abs(after['d'][0]-before['d'][0])>.03,(before,after)
    page.get_by_role('button',name='Entendido',exact=True).tap()
    expect(page.get_by_label('Guía de primeros pasos')).to_have_count(0)
    page.screenshot(path=str(root/'outputs'/'echo-mobile-playing.png'))
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    results.append({'case':'mobile-390-reduced-motion-multitouch','status':'PASS','errors':errors})
    # Controlled UI fixtures: check the new narrative dialogs on a 390px touch viewport.
    # This is not a substitute for the physical campaign test.
    page.evaluate("""async()=>{
      const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name;
      window.mobileGame=(await import(url)).useGame;
      const p=mobileGame.getState().progress;
      mobileGame.setState({phase:'journal',progress:{...p,cell:true,installed:true,power:true,door:true,story:{...p.story,zone:'lab',documents:['shift','evacuation','manual','measurements','copy','quarantine','consent']}}});
    }""")
    expect(page.get_by_role('dialog',name='Registro de descubrimientos')).to_be_visible()
    assert page.locator('.journal-layout nav button').count()==7
    page.get_by_role('button',name='Circuito de conservación').tap()
    expect(page.locator('.journal-layout article')).to_contain_text('Refrigeración debe recibir exactamente el doble')
    assert page.locator('dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
    page.screenshot(path=str(root/'outputs'/'echo-mobile-journal.png'))
    page.evaluate("mobileGame.setState({phase:'valve',valve:0})")
    page.get_by_label('Unidades del regulador').select_option('2')
    assert page.evaluate('mobileGame.getState().progress.story.dials[0]')==2
    page.evaluate("""()=>{
      const p=mobileGame.getState().progress;
      mobileGame.setState({phase:'terminal',activeTerminal:'core',progress:{...p,story:{...p.story,zone:'core',labSolved:true,dials:[2,4,3],order:['copy','quarantine','cut'],archiveVerified:true,stance:'confront'}}});
    }""")
    expect(page.get_by_role('dialog',name='Terminal ECHO')).to_be_visible()
    assert page.locator('dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
    page.get_by_role('button',name='Borrar y aislar a ECHO',exact=True).tap()
    page.get_by_role('button',name='Confirmar borrado irreversible',exact=True).tap()
    expect(page.locator('.protocol-fixed')).to_contain_text('ECHO aislada')
    assert page.get_by_label('Tu instrucción').count()==0
    page.evaluate("mobileGame.setState({phase:'complete',progress:{...mobileGame.getState().progress,complete:true}})")
    expect(page.get_by_role('heading',name='El último silencio.',exact=True)).to_be_visible()
    page.get_by_role('button',name='Behind the System').tap()
    expect(page.get_by_role('dialog',name='Behind the System')).to_be_visible()
    assert page.locator('dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
    page.get_by_role('button',name='Volver al desenlace').tap()
    assert not errors,errors
    results.append({'case':'mobile-narrative-dialogs-and-ending-controlled-fixtures','status':'PASS','errors':errors})
    print(json.dumps(results,ensure_ascii=False,indent=2),flush=True)
    (root/'outputs'/'browser-checks.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    browser.close()
