"""Compiled graphics regression with explicit camera/save fixtures; not a campaign or physical GPU test."""
import ast, json, os, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / 'work' / 'python'))
from playwright.sync_api import sync_playwright, expect

sys.stdout.reconfigure(encoding='utf-8')
(root / 'outputs').mkdir(exist_ok=True)
(root / 'work' / 'temp').mkdir(parents=True, exist_ok=True)
os.environ['TEMP'] = os.environ['TMP'] = str(root / 'work' / 'temp')
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
tree = ast.parse((root / 'tests' / 'playthrough.py').read_text(encoding='utf-8'))
binding = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == 'bind_runtime')
exec(compile(ast.Module(body=[binding], type_ignores=[]), 'bind_runtime', 'exec'))
results = []
with sync_playwright() as runner:
    browser = runner.chromium.launch(channel='chrome', headless=True, args=['--enable-unsafe-webgpu'])
    for renderer in ['webgl', 'webgpu']:
        context = browser.new_context(viewport={'width':1440, 'height':900}, reduced_motion='reduce')
        page = context.new_page()
        errors, external = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('request', lambda r: external.append(r.url) if not r.url.startswith((base.rstrip('/'), 'blob:', 'data:')) else None)
        save = {'cell':True, 'installed':True, 'power':True, 'door':True, 'complete':False,
                'story':{'version':1, 'zone':'core', 'seenLab':True, 'seenCore':True, 'labSolved':True,
                         'dials':[2,4,3], 'protocol':'none', 'documents':['shift','evacuation','manual','measurements','copy','quarantine','consent']}}
        page.add_init_script('localStorage.setItem("echo.awakening.v1",' + json.dumps(json.dumps(save)) + ')')
        page.goto(base + '?renderer=' + renderer, wait_until='networkidle')
        expect(page.get_by_role('button', name='CONTINUE EXPERIENCE')).to_be_enabled(timeout=45000)
        page.get_by_role('button', name='Ajustes y controles').click()
        page.get_by_label('Calidad gráfica').select_option('medium')
        page.get_by_label('Control de cámara').select_option('drag')
        page.get_by_role('button', name='Volver', exact=True).click()
        page.get_by_role('button', name='CONTINUE EXPERIENCE').click()
        bind_runtime()
        page.wait_for_function('qaGame.getState().labReady && qaGame.getState().coreReady', timeout=60000)
        checks = page.evaluate('''() => {
          const scene=qaScene.getState().scene, floors=[], columns=[];
          scene.traverse(o=>{
            if(o.material?.aoMap) {
              const m=o.material,t=m.aoMap,ctx=t.image.getContext('2d');
              const pixel=(x,y)=>ctx.getImageData(x,y,1,1).data[0];
              const contactZ=o.position.z===-1.7?0.2:o.position.z===-51?-49:-27;
              floors.push({name:t.name,width:t.image.width,space:t.colorSpace,repeat:t.repeat.toArray(),
                edge:pixel(1,128),open:pixel(210,100),
                contact:pixel(128,Math.round(((contactZ-o.position.z)/o.geometry.parameters.height+0.5)*256)),
                uuid:t.uuid,center:o.position.z});
              if(m.map===t)throw Error('Contact shading replaced the tiled albedo');
            }
            if(o.isInstancedMesh&&o.material.color.getHexString()==='364447')columns.push(o);
          });
          if(columns.length!==1||columns[0].count!==20||!columns[0].castShadow)throw Error('Structural instancing regressed');
          const data=columns[0].instanceMatrix.array;
          if(Math.abs(data[12]+8.3)>.001||data[14]!==-10||data[19*16+14]!==10)throw Error('Column placement changed');
          return {floors,backend:qaGame.getState().backend};
        }''')
        assert checks['backend'] == ('WEBGPU' if renderer == 'webgpu' else 'WEBGL 2')
        assert len(checks['floors']) == 3 and len({f['uuid'] for f in checks['floors']}) == 3, checks
        for floor in checks['floors']:
            assert floor['width'] == 256 and floor['repeat'] == [1, 1] and floor['space'] == '', floor
            assert floor['edge'] < floor['open'], floor
            assert floor['contact'] < floor['open'], floor
        for zone, position, target in [
            ('containment', [0,1.7,9], [0,3.3,0.2]),
            ('lab', [4.7,1.7,-19.5], [0,2.8,-27]),
            ('core', [5.3,1.7,-43.5], [0,4,-49]),
        ]:
            # Freeze player updates, render the real scene at a fixed inspection camera.
            page.evaluate('''({position,target})=>{
              qaGame.getState().set({phase:'paused'});
              const root=qaScene.getState();root.camera.position.set(...position);root.camera.lookAt(...target);root.invalidate();
            }''', {'position':position, 'target':target})
            page.wait_for_timeout(250)
            page.screenshot(path=str(root / 'outputs' / f'graphics-{renderer}-{zone}.png'),
                            style='.experience > :not(.world), dialog::backdrop { visibility: hidden !important; }')
        page.get_by_role('button', name='Reanudar experiencia').click()
        page.keyboard.down('ArrowRight'); page.wait_for_timeout(350); page.keyboard.up('ArrowRight')
        assert page.evaluate('qaGame.getState().phase') == 'playing'
        assert not errors and not external, (errors, external)
        results.append({'renderer':renderer, 'floors':checks['floors'], 'errors':errors, 'external':external})
        context.close()
    browser.close()
(root / 'outputs' / 'GRAPHICS-UI.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print('GRAPHICS UI PASS: both renderers, three contact maps, structural instances, resume; camera fixtures only')
