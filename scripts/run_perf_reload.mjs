#!/usr/bin/env node
import { launch } from '../build/src/browser.js';
import { logger } from '../build/src/logger.js';
import { McpContext } from '../build/src/McpContext.js';
import { McpResponse } from '../build/src/McpResponse.js';
import { startTrace } from '../build/src/tools/performance.js';

const URL = process.argv[2] || 'https://petstore.octoperf.com/actions/Catalog.action';
// HEADLESS env var controls whether Chrome runs headless. Set to 'false' to see the browser UI.
const HEADLESS = process.env.HEADLESS === undefined ? true : !(process.env.HEADLESS === 'false' || process.env.HEADLESS === '0');

(async () => {
  try {
  console.log('Launching Chrome... (headless=' + HEADLESS + ')');
  const browser = await launch({ headless: HEADLESS, isolated: true, devtools: false });
    console.log('Creating context...');
    const context = await McpContext.from(browser, logger, { experimentalDevToolsDebugging: false });
    console.log('Opening and navigating page to target URL');
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: ['load'] });
    console.log('Invoking performance_start_trace with reload=true autoStop=true');
    const response = new McpResponse();
    await startTrace.handler({ params: { reload: true, autoStop: true } }, response, context);
    const formatted = await response.handle(startTrace.name ?? 'performance_start_trace', context);
    for (const item of formatted) {
      if (item.type === 'text') {
        console.log('\n--- Performance Result ---\n');
        console.log(item.text);
      } else if (item.type === 'image') {
        console.log('\n--- Image attachment ---\n', item.filename ? `Saved as ${item.filename}` : item);
      }
    }
    try { await browser.close(); } catch (e) { }
  } catch (err) {
    console.error('Error during run:', err);
    process.exit(1);
  }
})();
