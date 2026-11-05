"""Compiled 3D switch/panel regression with a legacy save and camera fixtures, not a complete campaign."""
import ast, json, math, os, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / 'work' / 'python'))
from playwright.sync_api import sync_playwright, expect

sys.stdout.reconfigure(encoding='utf-8')
os.environ['TEMP'] = os.environ['TMP'] = str(root / 'work' / 'temp')
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
tree = ast.parse((root / 'tests' / 'playthrough.py').read_text(encoding='utf-8'))
for name in ['bind_runtime', 'snapshot', 'aim', 'use_target']:
    node = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == name)
    exec(compile(ast.Module(body=[node], type_ignores=[]), name, 'exec'))
results = []
with sync_playwright() as runner:
    browser = runner.chromium.launch(channel='chrome', headless=True, args=['--enable-unsafe-webgpu'])
    for renderer in ['webgl', 'webgpu']:
        context = browser.new_context(viewport={'width':1440, 'height':960}, reduced_motion='reduce')
        page = context.new_page(); errors, external = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('request', lambda r: external.append(r.url) if not r.url.startswith((base.rstrip('/'), 'blob:', 'data:')) else None)
        page.add_init_script('localStorage.setItem("echo.awakening.v1",JSON.stringify({cell:true,installed:false,power:false,door:false,complete:false}))')
        page.goto(base + '?renderer=' + renderer, wait_until='networkidle')
        expect(page.get_by_role('button', name='CONTINUE EXPERIENCE')).to_be_enabled(timeout=45000)
        page.get_by_role('button', name='Ajustes y controles').click()
        page.get_by_label('Calidad gráfica').select_option('medium')
        page.get_by_label('Control de cámara').select_option('drag')
        page.get_by_role('button', name='Volver', exact=True).click()
        page.get_by_role('button', name='CONTINUE EXPERIENCE').click(); bind_runtime()
        page.evaluate('qaScene.getState().camera.position.set(5.8,1.7,1.2)')
        use_target('supply:0', (5.25,2.7,-.7))
        assert page.evaluate('qaGame.getState().powerLines') == '100'
        use_target('supply-start', (5.8,2.3,-.9))
        assert not page.evaluate('qaGame.getState().progress.power'), 'Parts must be installed'
        use_target('relay', (5.8,1.5,-1.5))
        expect(page.get_by_role('checkbox', name='Soporte vital')).to_be_checked()
        for item in ['Fusible cerámico', 'Celda de arranque']:
            page.get_by_role('button', name=item, exact=True).click()
            page.get_by_role('button', name='Usar en distribuidor de arranque', exact=True).click()
        page.get_by_role('checkbox', name='Archivo', exact=True).check()
        page.get_by_role('button', name='Validar y energizar', exact=True).click()
        assert not page.evaluate('qaGame.getState().progress.power'), 'Wrong service priorities must be rejected'
        page.get_by_role('checkbox', name='Archivo', exact=True).uncheck()
        page.get_by_role('button', name='Volver a la instalación', exact=True).click()
        use_target('supply:2', (6.35,2.7,-.7))
        assert page.evaluate('qaGame.getState().powerLines') == '101'
        use_target('supply-start', (5.8,2.3,-.9))
        page.wait_for_function('qaGame.getState().progress.power')
        assert not page.evaluate('qaGame.getState().saveFailed')
        use_target('supply:0', (5.25,2.7,-.7))
        assert page.evaluate('qaGame.getState().powerLines') == '101', 'Validated power must stay locked'
        use_target('relay', (5.8,1.5,-1.5))
        expect(page.get_by_role('checkbox', name='Soporte vital')).to_be_checked()
        expect(page.get_by_role('checkbox', name='Soporte vital')).to_be_disabled()
        expect(page.get_by_role('checkbox', name='Refrigeración')).to_be_checked()
        page.get_by_role('button', name='Volver a la instalación', exact=True).click()
        assert not errors and not external, (errors, external)
        page.screenshot(path=str(root / 'outputs' / f'living-relay-{renderer}.png'))
        results.append({'renderer':renderer, 'physicalSupply':True, 'sharedPanel':True, 'invalidStartRejected':True,
                        'saveCompatible':True, 'lockedAfterPower':True, 'errors':errors, 'external':external})
        context.close()
    browser.close()
(root / 'outputs' / 'PHYSICAL-UI.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print('PHYSICAL UI PASS', json.dumps(results), flush=True)
