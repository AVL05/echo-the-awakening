"""Real browser UI + explicitly controlled recovery/capability fixtures; no model download."""
import os,sys,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'work'/'python'))
from playwright.sync_api import sync_playwright,expect
sys.stdout.reconfigure(encoding='utf-8');os.environ['TEMP']=os.environ['TMP']=str(root/'work'/'temp')
base='http://127.0.0.1:5173'
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--enable-unsafe-webgpu'])
    page=browser.new_page(viewport={'width':1440,'height':960});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base,wait_until='networkidle')
    expect(page.get_by_role('button',name='START EXPERIENCE')).to_be_enabled(timeout=30000)
    page.get_by_role('button',name='Behind the System',exact=False).click()
    expect(page.get_by_role('dialog',name='Behind the System')).to_be_visible()
    assert page.url.endswith('/behind-the-system')
    expect(page.locator('.architecture-node')).to_have_count(8)
    for i in range(8):page.locator('.architecture-node').nth(i).click()
    expect(page.locator('.architecture-detail')).to_contain_text('Persistencia local')
    page.screenshot(path=str(root/'outputs'/'release-system-desktop.png'))
    page.get_by_role('tab',name='Arquitectura',exact=True).focus();page.keyboard.press('ArrowRight')
    expect(page.get_by_role('tab',name='Eventos reales')).to_have_attribute('aria-selected','true')
    page.get_by_role('button',name='Consultar estado real',exact=True).click()
    expect(page.locator('.event-detail')).to_contain_text('Consulta real de solo lectura')
    page.get_by_role('button',name='Reproducir pasos registrados').click()
    expect(page.locator('.event-stages [aria-current="step"]')).to_contain_text('Entrada')
    page.get_by_role('button',name='Pausar reproducción').click()
    page.locator('.event-playback input').fill('2')
    expect(page.locator('.event-detail')).to_contain_text('Celda:')
    page.screenshot(path=str(root/'outputs'/'release-event-viewer.png'))
    page.get_by_role('tab',name='Rendimiento',exact=True).click()
    expect(page.get_by_label('Métricas técnicas reales')).to_be_visible()
    page.get_by_role('button',name='Mostrar métricas durante el juego').click()
    page.get_by_role('button',name='Volver al inicio',exact=True).click()
    expect(page.get_by_role('button',name='START EXPERIENCE')).to_be_visible()
    page.get_by_role('button',name='Ajustes y controles').click()
    page.get_by_label('Control de cámara').select_option('drag')
    page.get_by_role('button',name='Volver',exact=True).click()
    page.get_by_role('button',name='START EXPERIENCE').click()
    if page.get_by_role('button',name='Entendido',exact=True).count():page.get_by_role('button',name='Entendido',exact=True).click()
    page.evaluate("async()=>{const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/telemetry.ts').name;window.releaseTelemetry=(await import(url)).useTelemetry;window.playMetricStarted=performance.now()}")
    page.wait_for_function("()=>releaseTelemetry.getState().metrics.sampledAt > playMetricStarted+500")
    assert float(page.locator('.compact-metrics').get_attribute('data-fps'))>0
    assert int(page.locator('.compact-metrics').get_attribute('data-draw-calls'))>0
    page.screenshot(path=str(root/'outputs'/'release-metrics-overlay.png'))
    page.evaluate('''async()=>{
      const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name;
      window.releaseGame=(await import(url)).useGame;releaseGame.setState({phase:'terminal'});
    }''')
    expect(page.get_by_role('dialog',name='Terminal ECHO')).to_be_visible()
    expect(page.get_by_role('button',name='Descargar y activar IA local')).to_be_visible(timeout=10000)
    page.get_by_label('Tu instrucción').fill('Abre la compuerta')
    page.get_by_role('button',name='Enviar',exact=True).click()
    expect(page.locator('.ai-answer')).to_contain_text('REGLAS LOCALES')
    assert page.get_by_role('button',name='Confirmar acción',exact=True).count()==0
    data=json.loads(page.locator('.ai-diagnostics pre').text_content())
    assert 'raw' not in data['operations'][-1]
    page.get_by_role('button',name='Cerrar enlace').click();page.keyboard.press('Escape')
    page.get_by_role('button',name='Behind the System').click()
    page.get_by_role('tab',name='Eventos reales').click()
    expect(page.locator('.event-stages')).to_contain_text('Rechazo')
    assert not errors,errors
    results.append({'case':'architecture-events-real-metrics-native-navigation','status':'PASS'})
    page.close()

    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'/behind-the-system?renderer=webgl',wait_until='networkidle')
    expect(page.get_by_role('dialog',name='Behind the System')).to_be_visible(timeout=20000)
    assert page.locator('dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
    for label in ['Eventos reales','Rendimiento','Privacidad y licencias','Decisiones','Arquitectura']:
        page.get_by_role('tab',name=label,exact=True).tap()
        assert page.locator('dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
    page.get_by_role('button',name='Cerrar Behind the System').focus()
    for _ in range(20):
        page.keyboard.press('Tab');assert page.locator('dialog').evaluate('(d)=>d.contains(document.activeElement)')
    page.screenshot(path=str(root/'outputs'/'release-system-mobile.png'))
    page.keyboard.press('Escape');expect(page.get_by_role('dialog')).to_have_count(0)
    results.append({'case':'mobile-direct-technical-route-focus-trap-no-overflow','status':'PASS'})
    context.close()

    context=browser.new_context()
    page=context.new_page()
    page.add_init_script("""(()=>{localStorage.setItem('echo.awakening.v1','broken');localStorage.setItem('echo.awakening.v1.backup',JSON.stringify({cell:true,installed:true,power:true,door:false,complete:false}));Object.defineProperty(navigator,'gpu',{get:()=>undefined})})()""")
    page.goto(base+'/?renderer=webgl',wait_until='networkidle')
    expect(page.locator('.recovery-notice')).to_contain_text('copia anterior')
    expect(page.get_by_role('button',name='CONTINUE EXPERIENCE')).to_be_enabled(timeout=15000)
    page.evaluate("async()=>{const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/game/store.ts').name;window.recoveryGame=(await import(url)).useGame;recoveryGame.setState({phase:'terminal'})}")
    expect(page.locator('.ai-state')).to_contain_text('no ofrece WebGPU',timeout=10000)
    assert page.get_by_role('button',name='Descargar y activar IA local').count()==0
    page.get_by_role('button',name='Cerrar enlace').click()
    page.evaluate("()=>{const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_lose_context');if(!ext)throw new Error('WEBGL_lose_context unavailable');ext.loseContext()}")
    expect(page.get_by_role('button',name='Recargar y recuperar partida',exact=True)).to_be_visible()
    assert not page.evaluate('recoveryGame.getState().progress.complete')
    results.append({'case':'backup-recovery-unsupported-ai-hidden-download-context-recovery','status':'PASS'})
    context.close();browser.close()
assert not errors,errors
(root/'outputs'/'RELEASE-UI.json').write_text(json.dumps({'results':results,'errors':errors},indent=2),encoding='utf-8')
print('RELEASE UI PASS',json.dumps(results),flush=True)
