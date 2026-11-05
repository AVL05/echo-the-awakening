"""Explicit development-state fixtures: UI checks, not a physical campaign or real AI test."""
import ast, json, math, os, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / 'work' / 'python'))
from playwright.sync_api import sync_playwright, expect

sys.stdout.reconfigure(encoding='utf-8')
os.environ['TEMP'] = os.environ['TMP'] = str(root / 'work' / 'temp')
tree = ast.parse((root / 'tests' / 'playthrough.py').read_text(encoding='utf-8'))
binding = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == 'bind_runtime')
exec(compile(ast.Module(body=[binding], type_ignores=[]), 'bind_runtime', 'exec'))
for name in ['snapshot', 'aim', 'use_target']:
    function = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == name)
    exec(compile(ast.Module(body=[function], type_ignores=[]), name, 'exec'))
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
results = []
with sync_playwright() as runner:
    browser = runner.chromium.launch(channel='chrome', headless=True, args=['--enable-unsafe-webgpu'])
    for renderer in ['webgl', 'webgpu']:
        context = browser.new_context(viewport={'width':1440, 'height':960}, reduced_motion='reduce')
        page = context.new_page()
        errors, external = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: external.append(request.url) if not request.url.startswith((base.rstrip('/'), 'blob:', 'data:')) else None)
        page.goto(base + '?renderer=' + renderer, wait_until='networkidle')
        expect(page.get_by_role('button', name='START EXPERIENCE')).to_be_enabled(timeout=30000)
        bind_runtime()
        expect(page.locator('footer')).to_contain_text('WEBGPU' if renderer == 'webgpu' else 'WEBGL 2')
        # Build a coherent checkpoint through the game's rules; placement and phase are fixtures.
        page.evaluate('''async()=>{
          const {restoreSave,executeCommand}=await import('/src/game/progress.ts');
          const {escapeAction}=await import('/src/game/escape.ts');
          const {storyAction,updateStory,discover,DOCUMENTS}=await import('/src/game/story.ts');
          let p=restoreSave(null);
          const physical=(name,value='')=>{const r=escapeAction(name,value,p);if(!r.ok)throw Error(r.text);p=r.progress};
          physical('take','badge');physical('locker','1704');p={...p,cell:true};
          physical('use','cell:relay');physical('use','fuse:relay');physical('power','101');
          p=updateStory(executeCommand('unlock',p).progress,{zone:'lab',seenLab:true});
          physical('take','crank');window.qaLabCheckpoint=JSON.stringify(p);physical('use','crank:cabinet');physical('use','lens:optics');
          physical('mirrors','001');physical('optics');
          if(p.story.labSolved||!p.story.escape.opticsSolved)throw Error('Parallel investigation failed');
          p=restoreSave(JSON.stringify(p));
          p=storyAction('calibrate','243',p).progress;
          for(const id of Object.keys(DOCUMENTS))p=discover(p,id);
          p=updateStory(p,{zone:'core',seenCore:true});physical('use','wafer:reader');
          p=storyAction('verify_archive','copy,quarantine,cut',p).progress;
          p=storyAction('record_decision','confront',p).progress;
          window.qaEscapeCheckpoint=JSON.stringify(p);
          qaGame.getState().save(p);qaGame.getState().set({phase:'journal',inputMode:'drag'});
        }''')
        page.get_by_label('Documento 1', exact=True).select_option('copy')
        page.get_by_label('Documento 2', exact=True).select_option('quarantine')
        expect(page.locator('.evidence-columns')).to_contain_text('Consentimiento: vacío')
        expect(page.locator('.independent-record')).to_contain_text('lote C17')
        page.screenshot(path=str(root / 'outputs' / f'escape-evidence-{renderer}.png'))
        page.set_viewport_size({'width':390,'height':844})
        assert page.locator('dialog').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
        assert page.locator('.evidence-columns').evaluate('(el)=>getComputedStyle(el).gridTemplateColumns.split(" ").length') == 1
        for _ in range(12):
            page.keyboard.press('Tab')
            assert page.evaluate('document.querySelector("dialog").contains(document.activeElement)')
        page.screenshot(path=str(root / 'outputs' / f'escape-evidence-mobile-{renderer}.png'))
        page.set_viewport_size({'width':1440,'height':960})
        ending_cameras = []
        for protocol in ['preserve','erase']:
            page.evaluate('''()=>{qaGame.getState().save(JSON.parse(qaEscapeCheckpoint));qaGame.getState().set({phase:'mechanism',mechanism:'continuity'})}''')
            page.get_by_label('Alimentación del archivo',exact=True).select_option('aux' if protocol == 'preserve' else 'off')
            page.get_by_label('Autoridad de custodia',exact=True).select_option('human' if protocol == 'preserve' else 'none')
            page.get_by_label('Alimentación de salida',exact=True).select_option('aux')
            page.get_by_role('button',name='Validar independencia',exact=True).click()
            assert page.evaluate('qaGame.getState().progress.story.protocol') == 'none'
            page.get_by_role('button',name='Confirmar custodia humana' if protocol == 'preserve' else 'Confirmar aislamiento y borrado',exact=True).click()
            page.get_by_role('button',name='Seguir investigando',exact=True).click()
            assert page.evaluate('qaGame.getState().progress.story.protocol') == 'none'
            page.get_by_role('button',name='Confirmar custodia humana' if protocol == 'preserve' else 'Confirmar aislamiento y borrado',exact=True).click()
            page.get_by_role('button',name='Confirmar conservación' if protocol == 'preserve' else 'Confirmar borrado irreversible',exact=True).click()
            assert page.evaluate('qaGame.getState().progress.story.protocol') == protocol
            expect(page.get_by_role('button',name='Reconfigurar antes de confirmar',exact=True)).to_have_count(0)
            expect(page.get_by_role('button',name='Pedir orientación a ECHO',exact=True)).to_be_disabled()
            expect(page.get_by_text('Decisión ejecutada.',exact=False)).to_be_visible()
            assert page.get_by_role('button',name='Usar en control independiente del archivo',exact=True).count() == 0
            page.screenshot(path=str(root / 'outputs' / f'escape-final-{renderer}-{protocol}.png'))
            page.get_by_role('button',name='Volver a la instalación',exact=True).click()
            page.wait_for_timeout(500)
            page.evaluate('qaScene.getState().camera.position.set(0,1.7,-64.3)')
            page.wait_for_function("qaGame.getState().phase==='cinematic'", timeout=10000)
            page.wait_for_timeout(700)
            ending_cameras.append(snapshot()['p'])
            page.screenshot(path=str(root/'outputs'/f'living-ending-{renderer}-{protocol}.png'))
            page.wait_for_function("qaGame.getState().phase==='complete'", timeout=12000)
            assert page.evaluate('qaGame.getState().progress.complete')
        assert ending_cameras[0] != ending_cameras[1], 'Both endings must have their own camera composition'
        # Camera placement is a fixture; pointing, key input and interaction use the real raycaster.
        page.evaluate("()=>{qaGame.getState().save(JSON.parse(qaLabCheckpoint));qaScene.getState().camera.position.set(6.7,1.7,-18.5);qaGame.getState().set({phase:'playing',inputMode:'drag'})}")
        page.wait_for_function('()=>qaGame.getState().labReady')
        page.wait_for_timeout(500)
        page.evaluate('()=>qaScene.getState().camera.position.set(6.7,1.7,-18.5)')
        use_target('escape:cabinet',(6.7,1.5,-20.7))
        page.get_by_role('button',name='Manivela de servicio',exact=True).click()
        page.get_by_role('button',name='Usar en armario de óptica',exact=True).click()
        page.get_by_role('button',name='Volver a la instalación',exact=True).click()
        page.evaluate('()=>qaScene.getState().camera.position.set(0,1.7,-31.5)')
        use_target('escape:optics',(0,1.5,-33.8))
        page.get_by_role('button',name='Lente de verificación',exact=True).click()
        page.get_by_role('button',name='Usar en banco de verificación',exact=True).click()
        page.get_by_role('button',name='Volver a la instalación',exact=True).click()
        for i,xyz in enumerate([(-.3,2.1,-33.47),(-.3,2.55,-33.47)]): use_target('mirror:'+str(i),xyz)
        use_target('escape:optics',(0,1.5,-33.8))
        page.get_by_role('button',name='Verificar receptor',exact=True).click()
        page.get_by_role('button',name='Volver a la instalación',exact=True).click()
        assert page.evaluate('qaGame.getState().progress.story.escape.opticsSolved&&!qaGame.getState().progress.story.labSolved')
        page.screenshot(path=str(root/'outputs'/f'escape-optics-world-{renderer}.png'))
        for i,value in enumerate([2,4,3]):
            page.evaluate('(i)=>qaScene.getState().camera.position.set(-5.2,1.7,-22-i*5)',i)
            aim(-7.2,1.5,-21.18-i*5)
            page.wait_for_function('(target)=>qaGame.getState().target===target',arg='valve:'+str(i))
            for _ in range(value): page.keyboard.press('r')
        page.evaluate('()=>qaScene.getState().camera.position.set(-5.2,1.7,-23)')
        use_target('lab-validator',(-7.2,1.2,-24.24))
        assert page.evaluate('qaGame.getState().progress.story.labSolved&&qaGame.getState().progress.story.escape.opticsSolved')
        assert not errors and not external, (errors, external)
        results.append({'renderer':renderer,'scope':'explicit state fixtures, no AI','physicalRaycastingWithCameraFixtures':True,'parallelOpticsCheckpoint':True,'evidenceComparison':True,'mobileWidth':390,'keyboardFocus':True,'humanConfirmation':['preserve','erase'],'errors':errors,'externalDownloads':external})
        print('ESCAPE UI PASS', renderer, flush=True)
        context.close()
    browser.close()
(root / 'outputs' / 'ESCAPE-UI.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
