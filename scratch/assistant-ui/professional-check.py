"""Browser smoke check for the automatic assistant; all AI traffic is mocked."""
import json
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

OUT = Path(__file__).resolve().parent / 'professional'
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    turns = []
    calls = []
    next_language = [None]
    fail_next = [False]

    def mock_assistant(route):
        request = route.request
        calls.append(request.method)
        if request.method == 'DELETE':
            route.fulfill(json={})
        elif request.url.endswith('/turns'):
            data = request.post_data_json
            turns.append(data)
            assert data['languageMode'] == 'auto', data
            assert set(data['context']) <= {'surface', 'section'}
            if fail_next[0]:
                fail_next[0] = False
                route.fulfill(status=503, json={'error': {'code': 'unavailable'}})
                return
            lang = next_language[0] or data['language']
            next_language[0] = None
            answer = {
                'en': 'AegisOne helps your team identify phishing. I can guide you through protection, deployment and plans.',
                'ur': 'AegisOne آپ کی ٹیم کو فشنگ سے بچانے میں مدد کرتا ہے۔ میں سیٹ اپ میں آپ کی رہنمائی کر سکتا ہوں۔',
                'ur-Latn': 'AegisOne aap ki team ko phishing se bachane mein madad karta hai. Main setup mein rehnumai kar sakta hun.',
            }[lang]
            route.fulfill(json={
                'turnId': data['turnId'], 'answer': answer,
                'speechText': answer if lang == 'en' else 'میں آپ کی رہنمائی کر سکتا ہوں۔',
                'language': lang, 'sources': ['overview'],
                'actions': [{'type': 'open_documentation', 'target': 'overview'}],
                'status': 'complete',
            })
        else:
            route.fulfill(json={'id': 'ui-review', 'capability': 'mock-only', 'expiresAt': '2099-01-01T00:00:00Z'})

    page.route(re.compile(r'.*/api/assistant/sessions(?:/.*)?$'), mock_assistant)
    page.add_init_script("localStorage.setItem('cookieConsentAccepted', 'true')")
    page.goto('http://127.0.0.1:3000/', wait_until='domcontentloaded')
    page.get_by_role('button', name='Ask AegisOne', exact=True).click()
    panel = page.locator('.a1-panel')
    field = panel.locator('#a1-question')
    expect(panel.get_by_role('heading', name='How can I help?')).to_be_visible()
    expect(panel.locator('select')).to_have_count(0)
    expect(panel.locator('.a1-settings-toggle, .a1-enable-button, .a1-cloud-controls')).to_have_count(0)
    expect(field).to_be_focused()
    expect(panel.get_by_role('button', name='Send question', exact=True)).to_be_disabled()
    panel.screenshot(path=str(OUT / 'welcome.png'))
    page.screenshot(path=str(OUT / 'desktop.png'))

    for width, height in [(390, 844), (320, 568), (900, 600)]:
        page.set_viewport_size({'width': width, 'height': height})
        expect(field).to_be_in_viewport()
        expect(panel.get_by_role('button', name='Close assistant')).to_be_in_viewport()
        assert panel.evaluate('el => el.scrollWidth <= el.clientWidth'), 'Horizontal overflow'
        assert panel.locator('.a1-body').evaluate('el => el.scrollHeight <= el.clientHeight + 1'), 'Welcome needs scrolling'
        panel.screenshot(path=str(OUT / f'welcome-{width}.png'))

    page.set_viewport_size({'width': 1440, 'height': 1000})
    panel.get_by_role('button', name='Explain AegisOne', exact=True).click()
    expect(panel.locator('.a1-message-assistant')).to_have_count(1)
    assert len(turns) == 1, 'First prompt must call AI immediately'
    expect(panel.get_by_role('button', name='Read guide', exact=True)).to_have_count(0)
    expect(panel.get_by_role('button', name='New chat', exact=True)).to_be_visible()
    panel.screenshot(path=str(OUT / 'conversation.png'))

    # The model's detected response language wins over the local English hint.
    next_language[0] = 'ur'
    field.fill('Explain the AegisOne installation process')
    field.press('Enter')
    expect(panel.locator('.a1-message-assistant')).to_have_count(2)
    expect(page.locator('.a1-assistant')).to_have_attribute('dir', 'rtl')
    panel.screenshot(path=str(OUT / 'urdu.png'))
    field.fill('Mujhe AegisOne ka setup samjhao')
    field.press('Enter')
    expect(panel.locator('.a1-message-assistant')).to_have_count(3)
    assert turns[-1]['language'] == 'ur-Latn'
    expect(page.locator('.a1-assistant')).to_have_attribute('dir', 'ltr')
    field.fill('ok')
    field.press('Enter')
    expect(panel.locator('.a1-message-assistant')).to_have_count(4)
    assert turns[-1]['language'] == 'ur-Latn', 'Short follow-ups must preserve language'
    field.fill('Explain AegisOne pricing in English')
    field.press('Enter')
    expect(panel.locator('.a1-message-assistant')).to_have_count(5)
    assert turns[-1]['language'] == 'en'

    fail_next[0] = True
    field.fill('Explain AegisOne protection')
    field.press('Enter')
    expect(panel.get_by_role('alert')).to_be_visible()
    panel.get_by_role('button', name='Retry', exact=True).click()
    expect(panel.get_by_role('alert')).to_have_count(0)
    expect(panel.locator('.a1-message-assistant')).to_have_count(6)
    expect(panel.locator('.a1-message-user')).to_have_count(6)
    panel.get_by_role('button', name='New chat', exact=True).click()
    expect(panel.locator('.a1-message')).to_have_count(0)
    expect(panel.get_by_role('heading', name='How can I help?')).to_be_visible()
    panel.get_by_role('button', name='Explain AegisOne', exact=True).click()
    expect(panel.locator('.a1-message-assistant')).to_have_count(1)
    assert calls.count('DELETE') == 1
    panel.locator('.a1-privacy-details summary').click()
    expect(panel.locator('.a1-privacy-content')).to_be_visible()
    expect(panel.locator('.a1-privacy-content')).to_contain_text('Groq')
    page.set_viewport_size({'width': 320, 'height': 568})
    expect(panel.locator('.a1-privacy-content')).to_be_in_viewport(ratio=1)
    panel.screenshot(path=str(OUT / 'privacy-320.png'))
    page.keyboard.press('Escape')
    expect(page.get_by_role('button', name='Ask AegisOne', exact=True)).to_be_focused()
    print(json.dumps({'result': 'PASS', 'turns': len(turns), 'checks': [
        'AI from first prompt', 'no language/settings/enable controls',
        'desktop and mobile layout', 'model language overrides hint', 'Urdu RTL',
        'Roman Urdu continuity', 'English switch', 'retry without duplicate question',
        'reset keeps automatic AI', 'privacy disclosure', 'Escape restores focus',
    ]}))
    browser.close()
