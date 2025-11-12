#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { launch } from '../build/src/browser.js';
import { logger } from '../build/src/logger.js';
import { McpContext } from '../build/src/McpContext.js';
import { parseRawTraceBuffer, getTraceSummary } from '../build/src/trace-processing/parse.js';

const BASE = process.argv[2] || 'https://petstore.octoperf.com/actions/Catalog.action';
const HEADLESS = process.env.HEADLESS === undefined ? true : !(process.env.HEADLESS === 'false' || process.env.HEADLESS === '0');
const OUT_DIR = process.env.OUT_DIR || './perf-results';

async function ensureOut() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function save(name, text) {
  const file = path.join(OUT_DIR, name);
  await fs.writeFile(file, text, 'utf8');
  return file;
}

async function clickByText(page, selectorList, text) {
  return page.evaluate((selList, txt) => {
    const sels = selList.split(',');
    for (const sel of sels) {
      const nodes = Array.from(document.querySelectorAll(sel));
      for (const n of nodes) {
        if ((n.textContent || '').trim().toLowerCase().includes(txt.toLowerCase())) {
          n.click();
          return true;
        }
      }
    }
    return false;
  }, selectorList, text);
}

async function typeIfExists(page, selector, value) {
  try {
    const el = await page.$(selector);
    if (!el) return false;
    await el.click({ clickCount: 3 });
    await el.type(value);
    return true;
  } catch (e) {
    return false;
  }
}

async function recordTraceAround(page, name, actionFn, opts = { reload: true, autoStop: true }) {
  // Start tracing
  const categories = [
    '-*',
    'blink.console',
    'blink.user_timing',
    'devtools.timeline',
    'disabled-by-default-devtools.screenshot',
    'disabled-by-default-devtools.timeline',
    'disabled-by-default-devtools.timeline.invalidationTracking',
    'disabled-by-default-devtools.timeline.frame',
    'disabled-by-default-devtools.timeline.stack',
    'disabled-by-default-v8.cpu_profiler',
    'disabled-by-default-v8.cpu_profiler.hires',
    'latencyInfo',
    'loading',
    'disabled-by-default-lighthouse',
    'v8.execute',
    'v8',
  ];

  if (opts.reload) {
    // navigate to about:blank first to clear state
    try { await page.goto('about:blank', { waitUntil: ['networkidle0'] }); } catch (e) {}
  }
  await page.tracing.start({ categories });

  // perform action
  await actionFn();

  // Wait a short time for network and rendering work to settle
  await new Promise(r => setTimeout(r, 2500));

  const buffer = await page.tracing.stop();
  const parsed = await parseRawTraceBuffer(buffer);
  const summary = parsed && parsed.parsedTrace ? getTraceSummary(parsed) : `Error parsing trace: ${parsed?.error ?? 'unknown'}`;
  const fname = `${Date.now()}-${name.replace(/\s+/g, '_')}.txt`;
  const file = await save(fname, summary);
  return { parsed, summary, file };
}

async function run() {
  await ensureOut();
  console.log('Launching Chrome (headless=' + HEADLESS + ')');
  const browser = await launch({ headless: HEADLESS, isolated: true, devtools: false });
  try {
    const context = await McpContext.from(browser, logger, { experimentalDevToolsDebugging: false });
    const page = await context.newPage();

    const report = [];

    // 1) Home page
    console.log('Recording: Home page');
    const home = await recordTraceAround(page, 'home', async () => {
      await page.goto(BASE, { waitUntil: ['load'] });
    });
    report.push({ step: 'home', ...home });

    // 2) Navigate to Sign In page
    console.log('Recording: Sign In page');
    const signIn = await recordTraceAround(page, 'sign_in', async () => {
      // try link text
      const clicked = await clickByText(page, 'a,button', 'Sign In');
      if (!clicked) {
        // fallback: navigate commonly used signon URL
        await page.goto(new URL('/actions/Account.action?signonForm=', BASE).href, { waitUntil: ['load'] }).catch(() => {});
      }
  await new Promise(r => setTimeout(r, 1000));
    });
    report.push({ step: 'sign_in', ...signIn });

    // 3) Log in
    console.log('Recording: Login');
    const login = await recordTraceAround(page, 'login', async () => {
      // attempt common input names
      const typedUser = await typeIfExists(page, 'input[name="username"], input[id="username"], input[name="userid"]', 'j2ee');
      const typedPass = await typeIfExists(page, 'input[name="password"], input[id="password"]', 'j2ee');
      // submit
      const submitClicked = await clickByText(page, 'input[type="submit"], button', 'Login') || await clickByText(page, 'input[type="submit"], button', 'Sign In') || await clickByText(page, 'button', 'Submit');
      if (!submitClicked) {
        // try form submit
        await page.evaluate(() => { const f = document.querySelector('form'); if (f) f.submit(); });
      }
      await page.waitForNavigation({ waitUntil: ['load'], timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
    });
    report.push({ step: 'login', ...login });

    // 4a) Navigate to Fish category
    console.log('Recording: Fish category');
    const fish = await recordTraceAround(page, 'fish_category', async () => {
      const clicked = await clickByText(page, 'a,button', 'Fish');
      if (!clicked) {
        await page.goto(new URL('/actions/Catalog.action?categoryId=FISH', BASE).href, { waitUntil: ['load'] }).catch(() => {});
      }
      await page.waitForNavigation({ waitUntil: ['load'], timeout: 8000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
    });
    report.push({ step: 'fish', ...fish });

    // 4b) Click on a product (first product)
    console.log('Recording: product_click');
    const product = await recordTraceAround(page, 'product_click', async () => {
      // try to click first product link
      const clicked = await page.evaluate(() => {
        const sel = 'a[href*="Product.action"]';
        const el = document.querySelector(sel) || document.querySelector('a[href*="ViewItem"]');
        if (el) { el.click(); return true; }
        const anchors = Array.from(document.querySelectorAll('a')).find(a => /Product|Item|View/.test(a.textContent||''));
        if (anchors) { anchors.click(); return true; }
        return false;
      });
      if (!clicked) {
        // fallback: click first anchor
        const el = await page.$('a');
        if (el) await el.click();
      }
      await page.waitForNavigation({ waitUntil: ['load'], timeout: 8000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
    });
    report.push({ step: 'product', ...product });

    // 4c) Add item to cart
    console.log('Recording: add_to_cart');
    const addToCart = await recordTraceAround(page, 'add_to_cart', async () => {
      const added = await clickByText(page, 'button,input, a', 'Add to Cart');
      if (!added) {
        // try common cart form
        await page.evaluate(() => { const btn = document.querySelector('input[type="submit"][value*="Add"]') || document.querySelector('button'); if (btn) btn.click(); });
      }
      await page.waitForNavigation({ waitUntil: ['load'], timeout: 8000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
    });
    report.push({ step: 'add_to_cart', ...addToCart });

    // 4d) View cart
    console.log('Recording: view_cart');
    const viewCart = await recordTraceAround(page, 'view_cart', async () => {
      const clicked = await clickByText(page, 'a,button', 'Cart') || clickByText(page, 'a,button', 'View Cart') || clickByText(page, 'a,button', 'My Cart');
      if (!clicked) {
        await page.goto(new URL('/actions/Cart.action', BASE).href, { waitUntil: ['load'] }).catch(() => {});
      }
      await page.waitForNavigation({ waitUntil: ['load'], timeout: 8000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
    });
    report.push({ step: 'view_cart', ...viewCart });

    // 4e) Proceed to checkout (stop before confirming)
    console.log('Recording: proceed_to_checkout');
    const checkout = await recordTraceAround(page, 'proceed_to_checkout', async () => {
      const clicked = await clickByText(page, 'a,button', 'Proceed to Checkout') || clickByText(page, 'a,button', 'Proceed');
      if (!clicked) {
        // try to find checkout form
        await page.evaluate(() => { const btn = Array.from(document.querySelectorAll('button,input')).find(n => /Proceed|Checkout|Confirm/i.test(n.textContent||n.value||'')); if (btn) btn.click(); });
      }
      await page.waitForNavigation({ waitUntil: ['load'], timeout: 8000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1000));
    });
    report.push({ step: 'checkout', ...checkout });

    // 5) Logout
    console.log('Recording: logout');
    const logout = await recordTraceAround(page, 'logout', async () => {
      const clicked = await clickByText(page, 'a,button', 'Sign Out') || clickByText(page, 'a,button', 'Logout');
      if (!clicked) {
        await page.goto(new URL('/actions/Account.action?signoff=', BASE).href, { waitUntil: ['load'] }).catch(() => {});
      }
      await page.waitForNavigation({ waitUntil: ['load'], timeout: 8000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1000));
    });
    report.push({ step: 'logout', ...logout });

    // Collate report: produce a simple aggregated text
    let final = `Performance test report for ${BASE}\n\n`;
    for (const r of report) {
      final += `=== Step: ${r.step} ===\n`;
      final += `Trace file: ${r.file}\n`;
      final += `${r.summary}\n\n`;
    }
    const reportFile = await save(`final-report-${Date.now()}.txt`, final);
    console.log('Report saved to', reportFile);
    console.log('\n--- Quick summary ---\n');
    console.log(final);
  } finally {
    try { await browser.close(); } catch (e) {}
  }
}

run().catch(err => {
  console.error('Error during full scenario:', err);
  process.exit(1);
});
