import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BB_SERVER_URL;
if (!baseUrl) throw new Error('Run inside BB or set BB_SERVER_URL to the running BB app.');
const output = path.resolve(process.env.MD_PROMPT_REPORT_DIR ?? 'artifacts/e2e');
await mkdir(output, { recursive: true });
const results = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 2 });
// Traces include the app shell. Keep them local and opt in explicitly.
const captureTrace = process.env.MD_PROMPT_TRACE === '1';
if (captureTrace) await context.tracing.start({ screenshots: false, snapshots: true, sources: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const cli = (...args) => execFileSync('bb', ['md-prompt', ...args], { encoding: 'utf8' }).trim();
let initialMode;
try { initialMode = JSON.parse(cli('status', '--json')).enabled; } catch { /* Pre-install red run. */ }
async function check(name, action) {
  try {
    await action();
    results.push({ name, status: 'passed' });
  } catch (error) {
    results.push({ name, status: 'failed', message: String(error) });
    throw error;
  }
}
async function replaceDraft(editor, text) {
  await editor.click();
  await editor.press('ControlOrMeta+A');
  await page.keyboard.insertText(text);
  await waitUntil(async () => await draftText(editor) === text);
}
async function draftText(editor) {
  return editor.evaluate(root => {
    function read(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node instanceof HTMLBRElement) return node.classList.contains('ProseMirror-trailingBreak') ? '' : '\n';
      return Array.from(node.childNodes, read).join('');
    }
    return Array.from(root.children, read).join('\n');
  });
}
async function composerScreenshot(fileName) {
  const editor = page.locator('[contenteditable="true"]').first();
  const handle = await editor.evaluateHandle(editorNode => {
    const toggle = document.querySelector('button[aria-label*="Markdown highlighting"]');
    let container = editorNode;
    while (container.parentElement && !container.contains(toggle)) container = container.parentElement;
    if (container === document.body || container === document.documentElement) throw new Error('Composer boundary not found; refusing a full-window screenshot.');
    return container;
  });
  try {
    const element = handle.asElement();
    assert.ok(element, 'The screenshot target is an element');
    // Only this composer subtree is captured, never the project list or app shell.
    await element.screenshot({ path: path.join(output, fileName), animations: 'disabled' });
  } finally { await handle.dispose(); }
}
async function waitUntil(condition) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await condition()) return;
    await page.waitForTimeout(100);
  }
  throw new Error('Timed out waiting for the observable result.');
}
try {
  await page.goto(baseUrl);
  const editor = page.locator('[contenteditable="true"]').first();
  const toggle = page.getByRole('button', { name: /Turn (on|off) Markdown highlighting/ }).first();
  await check('Plugin loads in a real BB composer', async () => {
    await editor.waitFor({ timeout: 15000 });
    await toggle.waitFor({ timeout: 10000 });
  });
  cli('on');
  await waitUntil(async () => await toggle.getAttribute('aria-pressed') === 'true');
  await check('Typing styles Markdown without changing its characters', async () => {
    await replaceDraft(editor, '');
    await editor.pressSequentially('**bold** and *italic* with `code`');
    await waitUntil(async () => await editor.locator('[class*="mdp-"]').count() > 0);
    assert.equal(await draftText(editor), '**bold** and *italic* with `code`');
  });
  const draft = [
    '# Ship the change', '',
    '**Bold** and *italic* with ~~strike~~ and `inline code`.', '',
    '- [x] Read the code', '- [ ] Keep the draft intact', '',
    '> A quoted note with **nested emphasis**.', '',
    '| Step | Owner |', '| --- | --- |', '| Verify | AB |', '',
    'See [the docs](https://example.com) and 日本語 😀.', '',
    '```ts', 'const answer: number = 42 // still typing',
  ].join('\n');
  await check('Multiline paste and an unfinished fence highlight immediately', async () => {
    await replaceDraft(editor, draft);
    await waitUntil(async () => await editor.locator('.mdp-bg-1f2430').count() > 0);
    assert.equal(await draftText(editor), draft);
    assert.ok(await editor.locator('.mdp-fg-c586c0').count() > 0, 'Code keywords are highlighted');
    assert.ok(await editor.locator('.mdp-bold').count() > 0, 'Bold text is painted');
    assert.ok(await editor.locator('.mdp-italic').count() > 0, 'Italic text is painted');
    assert.ok(await editor.locator('.mdp-strike').count() > 0, 'Strikethrough is painted');
    await composerScreenshot('markdown-on.png');
  });
  const before = await draftText(editor);
  await check('Toggle removes painting immediately and preserves the draft', async () => {
    const painted = editor.locator('.mdp-bg-1f2430').first();
    assert.equal(await painted.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(31, 36, 48)');
    await toggle.click();
    await waitUntil(async () => await toggle.getAttribute('aria-pressed') === 'false');
    await waitUntil(async () => await painted.evaluate(node => getComputedStyle(node).backgroundColor) !== 'rgb(31, 36, 48)');
    assert.equal(await draftText(editor), before);
    await composerScreenshot('markdown-off.png');
  });
  await check('Saved mode survives a page reload', async () => {
    await page.reload();
    await toggle.waitFor();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    assert.equal(JSON.parse(cli('status', '--json')).enabled, false);
  });
  await check('CLI setting change repaints an open draft', async () => {
    await replaceDraft(editor, draft);
    cli('on');
    await waitUntil(async () => await toggle.getAttribute('aria-pressed') === 'true');
    await waitUntil(async () => await editor.locator('.mdp-bg-1f2430').first().evaluate(node => getComputedStyle(node).backgroundColor) === 'rgb(31, 36, 48)');
  });
  await check('Programming prose remains plain', async () => {
    const plain = '2*3*4 src/*.ts __init__ Array<string> arr[i][j] snake_case_name $5 ~/path';
    await replaceDraft(editor, plain);
    await waitUntil(async () => await draftText(editor) === plain);
    assert.equal(await editor.locator('[class*="mdp-"]').count(), 0);
  });
  await check('Oversized drafts stay editable and unpainted', async () => {
    const long = '**long** '.repeat(7000);
    await replaceDraft(editor, long);
    await waitUntil(async () => (await draftText(editor)).length === long.length);
    assert.equal(await editor.locator('[class*="mdp-"]').count(), 0);
    await replaceDraft(editor, '**back to normal**');
    await waitUntil(async () => await editor.locator('.mdp-bold').count() > 0);
  });
  await check('Compact composer retains its Markdown menu', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await toggle.waitFor();
    await toggle.click();
    await waitUntil(async () => await toggle.getAttribute('aria-pressed') === 'false');
    assert.equal(await draftText(editor), '**back to normal**');
    await composerScreenshot('compact.png');
    await toggle.click();
    await waitUntil(async () => await toggle.getAttribute('aria-pressed') === 'true');
    await page.setViewportSize({ width: 1280, height: 960 });
  });
  await check('Nested Markdown styles and code colour layers survive overlap', async () => {
    await replaceDraft(editor, '> **bold and italic**\n\n~~[linked strike](https://example.com)~~\n\n```ts\nconst n = 42');
    const nested = editor.locator('.mdp-bold.mdp-italic');
    assert.ok(await nested.count() > 0);
    const link = editor.locator('.mdp-underline.mdp-strike').first();
    assert.equal(await link.evaluate(node => getComputedStyle(node).textDecorationLine), 'underline line-through');
    const keyword = editor.locator('.mdp-fg-c586c0').first();
    assert.equal(await keyword.evaluate(node => getComputedStyle(node).color), 'rgb(197, 134, 192)');
    assert.equal(await keyword.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(31, 36, 48)');
  });
  await check('Invalid CLI and RPC input leave the saved mode intact', async () => {
    const saved = JSON.parse(cli('status', '--json'));
    const invalid = spawnSync('bb', ['md-prompt', 'on', '--unknown'], { encoding: 'utf8' });
    assert.notEqual(invalid.status, 0);
    const response = await context.request.post(`${baseUrl}/api/v1/plugins/md-prompt/rpc/setMode`, { data: { mode: 'invalid' } });
    assert.ok(response.status() >= 400);
    assert.deepEqual(JSON.parse(cli('status', '--json')), saved);
  });
  await check('Plugin reload preserves text and does not duplicate controls', async () => {
    const text = await draftText(editor);
    execFileSync('bb', ['plugin', 'reload', 'md-prompt'], { encoding: 'utf8' });
    await waitUntil(async () => await toggle.count() === 1 && await toggle.isVisible());
    assert.equal(await draftText(editor), text);
    assert.ok(await editor.locator('.mdp-bg-1f2430').count() > 0);
  });
  await check('Plugin disable removes painting and enable restores the same draft', async () => {
    const text = await draftText(editor);
    try {
      execFileSync('bb', ['plugin', 'disable', 'md-prompt'], { encoding: 'utf8' });
      await waitUntil(async () => await toggle.count() === 0);
      assert.equal(await editor.locator('[class*="mdp-"]').count(), 0);
      assert.equal(await draftText(editor), text);
    } finally {
      execFileSync('bb', ['plugin', 'enable', 'md-prompt'], { encoding: 'utf8' });
    }
    await toggle.waitFor();
    await waitUntil(async () => await editor.locator('.mdp-bg-1f2430').count() > 0);
    assert.equal(await draftText(editor), text);
  });
  await check('No plugin browser exceptions', async () => {
    assert.deepEqual(errors.filter(error => /md-prompt|mdp-/i.test(error)), []);
  });
  await check('Public screenshots contain only the composer', async () => {
    const code = [
      '# Code, while you type', '',
      '```ts', 'export const greet = (name: string): string => {', '  return `Hello, ${name}!`', '}', '```', '',
      '```python', 'def greet(name: str) -> str:', '    return f"Hello, {name}!"', '```', '',
      '```diff', '- const answer = 0', '+ const answer = 42', '',
    ].join('\n');
    await replaceDraft(editor, code);
    await composerScreenshot('code.png');
  });
  await replaceDraft(editor, '');
} catch (error) {
  await composerScreenshot('failure.png').catch(() => {});
  process.exitCode = 1;
  console.error(String(error));
} finally {
  if (typeof initialMode === 'boolean') cli(initialMode ? 'on' : 'off');
  if (captureTrace) await context.tracing.stop({ path: path.join(output, 'trace.zip') });
  await browser.close();
  await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ output, passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length }));
}
