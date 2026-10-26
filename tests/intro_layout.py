"""Regression: public entry actions must not overlap the footer on short desktop screens."""
import os, sys, json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'work'/'python'))
from playwright.sync_api import sync_playwright,expect
os.environ['TEMP']=os.environ['TMP']=str(root/'work'/'temp')
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4173/'
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--enable-unsafe-webgpu'])
    for width,height in [(1280,720),(1440,900),(390,844)]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width==390,has_touch=width==390,reduced_motion='reduce')
        page=context.new_page();page.goto(base,wait_until='networkidle')
        expect(page.get_by_role('button',name='START EXPERIENCE')).to_be_enabled(timeout=30000)
        footer=page.locator('.footer').bounding_box()
        for selector in ['.start-button','.system-entry','.intro-controls']:
            item=page.locator(selector)
            if item.is_visible():
                rect=item.bounding_box();assert rect['y']+rect['height']<=footer['y'],(width,height,selector,rect,footer)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.get_by_role('button',name='Behind the System',exact=False).click()
        expect(page.locator('.architecture-node')).to_have_count(8)
        page.get_by_role('button',name='Volver al inicio',exact=True).click()
        page.screenshot(path=str(root/'outputs'/f'public-entry-{width}x{height}.png'))
        results.append({'viewport':[width,height],'status':'PASS'});context.close()
    browser.close()
(root/'outputs'/'ENTRY-LAYOUT.json').write_text(json.dumps({'url':base,'results':results},indent=2),encoding='utf-8')
print('ENTRY LAYOUT PASS',json.dumps(results),flush=True)
