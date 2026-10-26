"""Real cached inference lifecycle in an explicit laboratory fixture; no physical-route claim."""
import os,sys,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'work'/'python'))
from playwright.sync_api import sync_playwright,expect
sys.stdout.reconfigure(encoding='utf-8');os.environ['TEMP']=os.environ['TMP']=str(root/'work'/'temp')
with sync_playwright() as p:
    context=p.chromium.launch_persistent_context(str(root/'work'/'echo-ai-browser'),channel='chrome',headless=True,viewport={'width':1440,'height':960},args=['--enable-unsafe-webgpu'])
    page=context.new_page();page.on('console',lambda m:print('CONSOLE',m.type,m.text[:600],flush=True) if m.type in ['error','warning'] else None)
    page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
    expect(page.get_by_role('button',name='CONTINUE EXPERIENCE')).to_be_enabled(timeout=30000)
    page.evaluate('''async()=>{
      const resources=performance.getEntriesByType('resource');
      window.lifecycleGame=(await import(resources.find(e=>new URL(e.name).pathname==='/src/game/store.ts').name)).useGame;
      window.lifecycleAi=(await import(resources.find(e=>new URL(e.name).pathname==='/src/ai/controller.ts').name));
      window.lifecycleTrace=(await import(resources.find(e=>new URL(e.name).pathname==='/src/game/telemetry.ts').name)).useTelemetry;
      const p=lifecycleGame.getState().progress;
      lifecycleGame.setState({phase:'terminal',activeTerminal:'lab',progress:{...p,complete:false,story:{...p.story,zone:'lab',labSolved:false,dials:[2,4,3],protocol:'none'}}});
    }''')
    def load():
        page.locator('.ai-load').click()
        expect(page.locator('[data-ai-status]')).to_have_attribute('data-ai-status','ready',timeout=250000)
        print('LOADED',flush=True)
    load()
    page.get_by_label('Tu instrucción').fill('Consulta el estado actual')
    page.get_by_role('button',name='Enviar',exact=True).click()
    expect(page.locator('[data-ai-status]')).to_have_attribute('data-ai-status','generating')
    page.get_by_role('button',name='Cancelar petición',exact=True).click()
    expect(page.locator('[data-ai-status]')).to_have_attribute('data-ai-status','off')
    print('CANCELLED',flush=True)
    load()
    page.get_by_label('Tu instrucción').fill('Calibra los reguladores a dos de contención, cuatro de refrigeración y tres de análisis.')
    page.get_by_role('button',name='Enviar',exact=True).click()
    expect(page.locator('.ai-answer')).to_be_visible(timeout=70000)
    data=page.evaluate('''()=>({state:lifecycleAi.useEchoAi.getState(),traces:lifecycleTrace.getState().traces})''')
    print('RESULT',json.dumps(data,ensure_ascii=False),flush=True)
    expect(page.locator('.ai-answer')).to_contain_text('INFERENCIA LOCAL REAL')
    expect(page.get_by_role('button',name='Confirmar acción')).to_be_visible()
    page.get_by_role('button',name='Confirmar acción').click()
    assert page.evaluate('lifecycleGame.getState().progress.story.labSolved')
    report={'status':'PASS','fixture':'controlled laboratory, real cached inference; no physical-route claim','cancelledWithoutAction':True,'reloadSucceeded':True,'confirmedLabSolved':True,'inferenceMs':data['state']['diagnostics'][-1]['elapsedMs'],'traces':page.evaluate('lifecycleTrace.getState().traces')}
    (root/'outputs'/'AI-LIFECYCLE.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('CANCEL / RELOAD / REAL INFERENCE / CONFIRM PASS',flush=True)
    context.close()
