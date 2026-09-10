// Optional browser checks: supply PLAYWRIGHT_MODULE / PLAYWRIGHT_EXECUTABLE when installed outside this repo.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const output = process.env.SCREENSHOT_DIR || '/tmp/yogobi-front-screenshots';
await mkdir(output, { recursive: true });
const errors = [];
function observe(page) { page.on('pageerror', error => errors.push(error.message)); }
async function visible(page, selector) { await page.locator(selector).waitFor({ state: 'visible' }); }
async function noOverflow(page) { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
async function enter(page) {
  await page.goto(base); await page.locator('#catalog button').first().waitFor({ state: 'attached' });
  await page.locator('[data-step="3"]').click(); await visible(page, '#form-error');
  assert.equal(await page.locator('[data-panel="1"]').isVisible(), true);
  await page.locator('#monthly-data').fill('20'); await page.locator('#fee').fill('55000');
  await page.locator('#next').click();
  await page.getByRole('button', { name: '넷플릭스 +', exact: true }).click();
  await page.locator('#next').click();
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage(); observe(page);
  await page.goto(base); await page.locator('#catalog button').first().waitFor({ state: 'attached' });
  await page.screenshot({ path: `${output}/desktop-input.png`, fullPage: true }); await noOverflow(page);
  await enter(page);
  const recommended = page.waitForResponse(r => r.url().endsWith('/api/v1/recommendations') && r.request().method() === 'POST');
  await page.locator('#next').click(); const payload = await (await recommended).json(); await visible(page, '#results');
  const server = payload.data;
  assert.equal(await page.locator('.result-card').count(), server.results.length);
  assert.ok((await page.locator('#detail-summary').textContent()).includes(server.results[0].monthlyTotal.toLocaleString('ko-KR')));
  assert.ok((await page.locator('#results').textContent()).includes('할인 없는 정가'));
  assert.equal(await page.locator('#missing-section').isVisible(), true);
  await page.locator('#benefits-section').evaluate(node => { node.open = true; });
  await page.waitForFunction(() => !document.getElementById('benefits-status').textContent.includes('불러오고'));
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/desktop-results.png`, fullPage: true }); await noOverflow(page);
  const calculated = page.waitForResponse(r => r.url().endsWith('/api/v1/calculator'));
  await page.locator('#exact-calculate').click(); const exact = await (await calculated).json();
  await page.waitForFunction(() => document.getElementById('results-title').textContent.includes('계산 결과'));
  assert.ok((await page.locator('#detail-summary').textContent()).includes(exact.data.result.monthlyTotal.toLocaleString('ko-KR')));
  const downloaded = page.waitForEvent('download'); await page.locator('#download').click();
  assert.equal((await downloaded).suggestedFilename(), '요고비-비교표.csv');
  await page.locator('#chat-panel').evaluate(node => { node.open = true; });
  await page.locator('#chat-text').fill('데이터 20기가 넷플릭스'); await page.locator('#chat-send').click();
  await visible(page, '#chat-fallback'); assert.ok((await page.locator('#chat-message').textContent()).length > 10);
  console.log('PASS real BE: filter, server amounts, missing inputs, benefits, exact tiers, CSV, AI fallback');

  // Deterministic failure/race/XSS paths supplement the real backend checks.
  await enter(page);
  await page.route('**/api/v1/recommendations', route => route.fulfill({ status: 422, json: { error: { code: 'YGB-CAL-001', message: '후보 없음' } } }));
  await page.locator('#next').click(); await visible(page, '#form-error');
  assert.equal(await page.locator('[data-panel="3"]').isVisible(), true);
  assert.equal(await page.locator('#monthly-data').inputValue(), '20');
  await page.unroute('**/api/v1/recommendations');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/v1/recommendations', async route => { await gate; try { await route.fulfill({ json: payload }); } catch {} });
  await page.locator('#next').click(); await visible(page, '#loading'); await page.locator('#cancel-request').click(); release();
  await page.unroute('**/api/v1/recommendations', { behavior: 'wait' });
  assert.equal(await page.locator('[data-panel="1"]').isVisible(), true);
  await page.route('**/api/v1/catalog/services', route => route.fulfill({ json: { data: [{ id: 91, name: '<img src=x onerror="window.injected=1">', category: 'OTT', officialUrl: 'javascript:alert(1)', tiers: [{ id: 92, name: '테스트', price: 100 }] }], warnings: [] } }));
  await page.goto(base); await page.locator('#catalog button').first().waitFor({ state: 'attached' });
  assert.equal(await page.locator('#catalog img').count(), 0); assert.equal(await page.evaluate(() => window.injected), undefined);
  await page.unroute('**/api/v1/catalog/services');
  await page.route('**/api/v1/catalog/services', route => route.abort()); await page.reload();
  await page.waitForFunction(() => document.getElementById('catalog-status').textContent.includes('연결하지'));
  await page.unroute('**/api/v1/catalog/services'); await page.locator('#monthly-data').fill('20'); await page.locator('#next').click();
  await page.locator('#reload-catalog').click(); await page.locator('#catalog button').first().waitFor({ state: 'attached' });
  console.log('PASS UI: validation bypass, 422 retry, cancellation, API-string escaping, offline recovery');
  await enter(page);
  await page.locator('#calculator-panel').evaluate(node => { node.open = true; });
  await page.waitForFunction(() => document.getElementById('calculator-plan').options.length > 1);
  await page.locator('#calculator-plan').selectOption({ index: 1 });
  await page.locator('#calculate-chosen').click(); await visible(page, '#results');
  assert.ok((await page.locator('#results-title').textContent()).includes('계산 결과'));
  console.log('PASS real BE: plan catalog and direct combination calculator');

  await page.goto(`${base}/account.html`); await page.locator('#email').fill('nobody@example.com'); await page.locator('#password').fill('not-the-password');
  await page.locator('#login-form button').click(); await page.waitForFunction(() => document.getElementById('message').textContent.length > 0);
  assert.equal(await page.locator('#password').inputValue(), '');
  const csrf = [];
  page.on('request', r => { if (r.url().endsWith('/api/v1/auth/csrf')) csrf.push(r.url()); });
  await page.locator('#mail-email').fill('nobody@example.com'); await page.locator('#mail-form button').click();
  await page.waitForFunction(() => document.getElementById('message').textContent.includes('메일'));
  assert.equal(csrf.length, 1);
  console.log('PASS real BE: failed login, password clearing, fresh CSRF, mail-disabled error');
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  const phone = await mobile.newPage(); observe(phone);
  await phone.goto(base); await phone.locator('#catalog button').first().waitFor({ state: 'attached' });
  await phone.screenshot({ path: `${output}/mobile-input.png`, fullPage: true }); await noOverflow(phone);
  await enter(phone); await phone.locator('#next').click(); await visible(phone, '#results');
  await phone.screenshot({ path: `${output}/mobile-results.png`, fullPage: true }); await noOverflow(phone);
  await phone.goto(`${base}/account.html`); await phone.screenshot({ path: `${output}/mobile-account.png`, fullPage: true }); await noOverflow(phone);
  await mobile.close();
  assert.deepEqual(errors, []); console.log('PASS desktop/mobile: no overflow or uncaught browser errors');
} finally { await browser.close(); }
