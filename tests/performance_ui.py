"""Production regression of graphics controls, shadow scheduling and paused telemetry."""
import ast, json, os, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root/'work'/'python'))
from playwright.sync_api import sync_playwright, expect

sys.stdout.reconfigure(encoding='utf-8')
os.environ['TEMP'] = os.environ['TMP'] = str(root/'work'/'temp')
base = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4173/'
tree = ast.parse((root/'tests'/'playthrough.py').read_text(encoding='utf-8'))
binding = next(n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name=='bind_runtime')
exec(compile(ast.Module(body=[binding],type_ignores=[]),'bind_runtime','exec'))
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--enable-unsafe-webgpu'])
    for renderer in ['webgpu','webgl']:
        context=browser.new_context(viewport={'width':1920,'height':1080},device_scale_factor=2)
        page=context.new_page();errors=[];external=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        page.on('request',lambda r:external.append(r.url) if not r.url.startswith((base.rstrip('/'),'blob:','data:')) else None)
        page.goto(base+'?renderer='+renderer,wait_until='networkidle')
        expect(page.get_by_role('button',name='START EXPERIENCE')).to_be_enabled(timeout=30000)
        page.get_by_role('button',name='Ajustes y controles').click()
        page.get_by_label('Control de cámara').select_option('drag')
        page.get_by_label('Calidad gráfica').select_option('laptop')
        page.get_by_label('Mostrar métricas reales durante el juego').check()
        page.get_by_role('button',name='Volver',exact=True).click()
        page.get_by_role('button',name='START EXPERIENCE').click()
        if page.get_by_role('button',name='Entendido',exact=True).count():page.get_by_role('button',name='Entendido',exact=True).click()
        bind_runtime();page.wait_for_timeout(2500)
        assert page.evaluate('qaGame.getState().tier')=='laptop'
        assert page.evaluate('1920*1080*qaScene.getState().gl.getPixelRatio()**2')<=1200001
        assert not page.evaluate("performance.getEntriesByType('resource').some(e=>e.name.includes('echo.worker')||e.name.includes('/energy-'))")
        page.evaluate('''()=>{const light=qaScene.getState().scene.children.flatMap(o=>{const a=[];o.traverse(n=>{if(n.isSpotLight&&n.castShadow)a.push(n)});return a})[0];window.qaShadow=light.shadow;window.qaShadowTicks=0;let value=qaShadow.needsUpdate;Object.defineProperty(qaShadow,'needsUpdate',{get:()=>value,set:v=>{value=v;if(v)qaShadowTicks++},configurable:true})}''')
        page.wait_for_timeout(1500)
        ticks=page.evaluate('qaShadowTicks')
        assert 8<=ticks<=16,ticks
        assert page.evaluate('qaShadow.autoUpdate') is False
        assert page.evaluate('qaShadow.map.width')==512
        panel=page.get_by_label('Métricas técnicas reales')
        expect(panel).to_contain_text('Cuadro p95');expect(panel).to_contain_text('DPR interno')
        assert float(panel.get_attribute('data-fps'))>0
        page.screenshot(path=str(root/'outputs'/f'perf-panel-{renderer}.png'))
        page.keyboard.press('Escape');page.wait_for_timeout(500)
        before=page.evaluate('qaScene.getState().gl.info.render.frame??qaScene.getState().gl.info.calls')
        page.wait_for_timeout(1800)
        assert page.evaluate('qaScene.getState().gl.info.render.frame??qaScene.getState().gl.info.calls')==before
        for quality in ['low','medium','high','auto','laptop']:
            page.get_by_label('Calidad gráfica').select_option(quality)
            expected='laptop' if quality=='auto' else quality
            page.wait_for_function('(tier)=>qaGame.getState().tier===tier',arg=expected)
        page.get_by_label('Calidad gráfica').select_option('medium')
        page.get_by_label('Efectos atmosféricos avanzados',exact=False).uncheck()
        page.wait_for_function("()=>{let field=false;qaScene.getState().scene.traverse(o=>{if(o.material?.name?.includes('containment bands'))field=true});return !field}")
        page.get_by_role('button',name='Reanudar experiencia').click();page.wait_for_timeout(2200)
        if renderer=='webgpu':
            page.keyboard.press('Escape')
            page.get_by_label('Calidad gráfica').select_option('laptop')
            page.get_by_role('button',name='Reanudar experiencia').click()
            cdp=context.new_cdp_session(page)
            cdp.send('Emulation.setCPUThrottlingRate',{'rate':24})
            changes=page.evaluate('''async()=>{const start=performance.now(),changes=[];const unsubscribe=qaGame.subscribe((s,p)=>{if(s.resolutionScale!==p.resolutionScale)changes.push({ms:performance.now()-start,scale:s.resolutionScale,tier:s.tier})});await new Promise(r=>setTimeout(r,45000));unsubscribe();return changes}''')
            cdp.send('Emulation.setCPUThrottlingRate',{'rate':1})
            assert len(changes)>=2,changes
            assert all(c['tier']=='laptop' and .7<=c['scale']<=1 for c in changes),changes
            assert all(b['ms']-a['ms']>=11500 for a,b in zip(changes,changes[1:])),changes
            results.append({'case':'synthetic CDP CPU x24, not laptop performance','resolutionChanges':changes,'cooldown':'12s minimum (observer tolerance 0.5s)'})
        assert not errors and not external,(errors,external)
        results.append({'renderer':renderer,'shadowRequestsPer1_5Seconds':ticks,'pixelsAtMost':1200000,'pausedRendering':'stops','profiles':'all selectable','errors':errors})
        context.close()
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
    page=context.new_page()
    page.add_init_script("Object.defineProperty(navigator,'gpu',{get:()=>undefined})")
    page.goto(base,wait_until='networkidle')
    expect(page.get_by_role('button',name='START EXPERIENCE')).to_be_enabled(timeout=30000)
    expect(page.locator('footer')).to_contain_text('WEBGL 2')
    page.get_by_role('button',name='Ajustes y controles').tap()
    assert page.locator('dialog').evaluate('(d)=>d.scrollWidth<=d.clientWidth+1')
    page.get_by_label('Calidad gráfica').select_option('laptop')
    page.screenshot(path=str(root/'outputs'/'perf-settings-mobile.png'))
    results.append({'case':'touch-emulated settings, 390px, DPR2, automatic WebGL2 fallback','overflow':False})
    context.close()
    context=browser.new_context(reduced_motion='reduce')
    page=context.new_page()
    page.add_init_script("localStorage.setItem('echo.awakening.v1',JSON.stringify({cell:true,installed:true,power:true,door:false,complete:false}))")
    page.goto(base,wait_until='networkidle')
    expect(page.get_by_role('button',name='CONTINUE EXPERIENCE')).to_be_enabled(timeout=30000)
    page.get_by_role('button',name='Ajustes y controles').click()
    page.get_by_label('Control de cámara').select_option('drag')
    page.get_by_role('button',name='Volver',exact=True).click()
    page.get_by_role('button',name='CONTINUE EXPERIENCE').click();bind_runtime()
    page.wait_for_function("()=>{let opacity;qaScene.getState().scene.traverse(o=>{if(o.isSprite)opacity=o.material.opacity});return opacity===.48}")
    page.evaluate('()=>qaGame.getState().save({...qaGame.getState().progress,power:false})')
    page.wait_for_function("()=>{let opacity;qaScene.getState().scene.traverse(o=>{if(o.isSprite)opacity=o.material.opacity});return opacity===.24}")
    results.append({'case':'reduced-motion power fixture','halo':'final intensity updates without motion'})
    context.close();browser.close()
(root/'outputs'/'PERFORMANCE-UI.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print('PERFORMANCE UI PASS',json.dumps(results),flush=True)
