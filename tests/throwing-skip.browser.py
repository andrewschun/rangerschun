"""Run against docs served on port 8000: python3 tests/throwing-skip.browser.py."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    page.goto('http://127.0.0.1:8000/data.json', wait_until='networkidle')
    page.on('pageerror', lambda e: print('PAGE ERROR:', e, flush=True))
    page.set_default_timeout(5000)
    page.evaluate('''async () => {
      const {startThrowingCalendar} = await import('/throwing-calendar-ui.mjs');
      window.mountCalendar = () => {
        document.body.innerHTML = `<select id="throwing-player"><option>Alice</option><option>Bob</option></select>
          <input type="date" id="throwing-calendar-start"><table><tbody id="throwing-calendar-body"></tbody></table>
          <p id="throwing-calendar-message"></p><p id="throwing-calendar-summary"></p>
          <div id="throwing-calendar-choice"></div><form id="throwing-form"></form>
          <h2 id="throwing-form-title"></h2><div id="throwing-library-content"></div>`;
        window.records = []; window.listeners = [];
        window.calendar = startThrowingCalendar({players:['Alice','Bob'],scope:'skip-test',
          element:id=>document.getElementById(id), subscribe:fn=>listeners.push(fn),
          flow:{records:()=>records,openTemplate:()=>true,hasDraft:()=>false,
            setOffDay:({player,date,completed})=>{records=completed?[{player,session_date:date,
              source_template_id:'throwing-routine-off',completion_status:'completed',completion_confirmed:true}]:[];}}
        });
      };
      localStorage.removeItem('rangers-throwing-calendar-v1-skip-test'); mountCalendar();
    }''')
    page.add_style_tag(url='http://127.0.0.1:8000/style.css')
    day = page.locator('button[data-week="1"][data-day="2"]')
    skip = page.get_by_role('checkbox', name='Skip throwing day', exact=False)
    page.locator('#throwing-calendar-start').fill('2026-11-01')
    page.locator('#throwing-calendar-start').dispatch_event('change')
    day.click(); skip.check()
    assert day.locator('.throwing-calendar-s').text_content() == 'S'
    assert day.locator('.throwing-calendar-s').evaluate('(e)=>getComputedStyle(e).color') == 'rgb(180, 35, 24)'
    page.evaluate('mountCalendar()')  # Reload saved state into a fresh calendar instance.
    assert day.locator('.throwing-calendar-s').text_content() == 'S'
    day.click(); assert skip.is_checked()
    skip.uncheck(); assert day.locator('.throwing-calendar-s').count() == 0
    skip.check()
    page.locator('#throwing-player').select_option('Bob')
    page.locator('#throwing-calendar-start').fill('2026-11-01')
    page.locator('#throwing-calendar-start').dispatch_event('change')
    assert day.locator('.throwing-calendar-s').count() == 0
    page.locator('#throwing-player').select_option('Alice')
    page.evaluate('''() => {records=[{player:'Alice',session_date:'2026-11-02',source_template_id:'throwing-routine-hybrid-b',completion_status:'completed',completion_confirmed:true}];calendar.render()}''')
    assert day.locator('.throwing-calendar-x').text_content() == 'X'
    assert day.locator('.throwing-calendar-s').count() == 0
    day.click(); assert skip.is_disabled()
    # A failed write must roll the checkbox back and report that saving failed.
    page.evaluate('records=[];calendar.render()')
    skip.uncheck()
    page.evaluate("() => {Storage.prototype.setItem = () => {throw new Error('quota')}}")
    skip.click()
    assert not skip.is_checked()
    assert 'could not be saved' in page.locator('#throwing-calendar-message').text_content()
    browser.close()
    print('PASS: skip, red S, persistence, undo, player isolation, completed X, storage failure')
