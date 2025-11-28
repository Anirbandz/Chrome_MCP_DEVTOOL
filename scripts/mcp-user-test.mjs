#!/usr/bin/env node
/**
 * Single User Test - Direct interaction with MCP tools
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const TARGET_URL = 'https://petstore.octoperf.com/actions/Catalog.action';

async function performMCPStyleTest() {
  console.log('🚀 Starting MCP-Style Single User Test\n');
  console.log(`🎯 Target: ${TARGET_URL}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: false
  });

  const page = await browser.newPage();
  const client = await page.createCDPSession();
  
  await client.send('Network.enable');
  await client.send('Performance.enable');
  await client.send('Console.enable');
  await client.send('Page.enable');

  const testResults = {
    url: TARGET_URL,
    timestamp: new Date().toISOString(),
    tests: []
  };

  const networkRequests = [];
  const consoleLogs = [];

  // Network tracking
  client.on('Network.requestWillBeSent', (params) => {
    networkRequests.push({
      url: params.request.url,
      method: params.request.method,
      type: params.type,
      timestamp: params.timestamp
    });
  });

  client.on('Network.responseReceived', (params) => {
    const req = networkRequests.find(r => r.url === params.request?.url);
    if (req) {
      req.status = params.response.status;
      req.mimeType = params.response.mimeType;
    }
  });

  // Console tracking
  client.on('Console.messageAdded', (params) => {
    consoleLogs.push({
      level: params.message.level,
      text: params.message.text,
      source: params.message.source
    });
  });

  try {
    // Test 1: Navigate
    console.log('📍 Test 1: Navigation...');
    const startTime = Date.now();
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    const loadTime = Date.now() - startTime;
    testResults.tests.push({
      name: 'Navigation',
      status: 'success',
      loadTime: `${loadTime}ms`
    });
    console.log(`✅ Navigated successfully (${loadTime}ms)\n`);

    // Test 2: Page Info
    console.log('📋 Test 2: Page Information...');
    const pageInfo = {
      title: await page.title(),
      url: page.url(),
      viewport: page.viewport()
    };
    testResults.tests.push({
      name: 'Page Information',
      status: 'success',
      data: pageInfo
    });
    console.log(`✅ Title: "${pageInfo.title}"\n`);

    // Test 3: DOM Snapshot
    console.log('📸 Test 3: DOM Snapshot...');
    const domSnapshot = await page.evaluate(() => {
      const getElementInfo = (el) => {
        if (!el) return null;
        return {
          tag: el.tagName,
          id: el.id || undefined,
          classes: el.className ? el.className.split(' ') : undefined,
          text: el.innerText?.substring(0, 50) || undefined
        };
      };

      return {
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(getElementInfo),
        links: Array.from(document.querySelectorAll('a')).slice(0, 10).map(el => ({
          text: el.innerText?.substring(0, 30),
          href: el.href
        })),
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt
        })),
        forms: Array.from(document.querySelectorAll('form')).length,
        buttons: Array.from(document.querySelectorAll('button, input[type="submit"]')).length
      };
    });
    testResults.tests.push({
      name: 'DOM Snapshot',
      status: 'success',
      data: domSnapshot
    });
    console.log(`✅ Found ${domSnapshot.images.length} images, ${domSnapshot.links.length} links\n`);

    // Test 4: Performance Metrics
    console.log('⚡ Test 4: Performance Metrics...');
    const performanceMetrics = await page.evaluate(() => {
      const timing = performance.timing;
      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        domInteractive: timing.domInteractive - timing.navigationStart,
        dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
        tcpConnection: timing.connectEnd - timing.connectStart,
        serverResponse: timing.responseEnd - timing.requestStart
      };
    });
    testResults.tests.push({
      name: 'Performance Metrics',
      status: 'success',
      data: performanceMetrics
    });
    console.log(`✅ DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms\n`);

    // Test 5: Network Analysis
    console.log('🌐 Test 5: Network Analysis...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const networkStats = {
      totalRequests: networkRequests.length,
      byType: {},
      failed: 0
    };
    networkRequests.forEach(req => {
      const type = req.type || 'other';
      networkStats.byType[type] = (networkStats.byType[type] || 0) + 1;
      if (req.status >= 400) networkStats.failed++;
    });
    testResults.tests.push({
      name: 'Network Analysis',
      status: 'success',
      data: networkStats
    });
    console.log(`✅ Total Requests: ${networkStats.totalRequests}, Failed: ${networkStats.failed}\n`);

    // Test 6: Console Logs
    console.log('📝 Test 6: Console Logs...');
    const consoleStats = {
      total: consoleLogs.length,
      byLevel: {}
    };
    consoleLogs.forEach(log => {
      consoleStats.byLevel[log.level] = (consoleStats.byLevel[log.level] || 0) + 1;
    });
    testResults.tests.push({
      name: 'Console Logs',
      status: 'success',
      data: consoleStats
    });
    console.log(`✅ Console Messages: ${consoleStats.total}\n`);

    // Test 7: Screenshot
    console.log('📷 Test 7: Screenshot...');
    const screenshotPath = path.join(process.cwd(), 'performance-reports', `mcp-test-screenshot-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    testResults.tests.push({
      name: 'Screenshot',
      status: 'success',
      filePath: screenshotPath
    });
    console.log(`✅ Screenshot saved: ${screenshotPath}\n`);

    // Test 8: Accessibility Check
    console.log('♿ Test 8: Basic Accessibility...');
    const a11y = await page.evaluate(() => {
      return {
        imagesWithoutAlt: Array.from(document.querySelectorAll('img:not([alt])')).length,
        linksWithoutText: Array.from(document.querySelectorAll('a')).filter(a => !a.innerText.trim()).length,
        headingStructure: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.tagName),
        hasMainLandmark: !!document.querySelector('main, [role="main"]'),
        hasNavLandmark: !!document.querySelector('nav, [role="navigation"]')
      };
    });
    testResults.tests.push({
      name: 'Accessibility Check',
      status: 'success',
      data: a11y
    });
    console.log(`✅ Accessibility scan complete\n`);

    // Save detailed results
    const reportPath = path.join(process.cwd(), 'performance-reports', `mcp-test-results-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));

    // Print detailed summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 MCP DEVTOOLS SINGLE USER TEST RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`🌐 URL: ${TARGET_URL}`);
    console.log(`📅 Timestamp: ${new Date().toLocaleString()}\n`);

    console.log('✅ TEST SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    testResults.tests.forEach((test, idx) => {
      console.log(`   ${idx + 1}. ${test.name.padEnd(25)} ${test.status}`);
    });
    console.log('');

    console.log('📊 DETAILED RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Page Title:              ${pageInfo.title}`);
    console.log(`   Load Time:               ${loadTime}ms`);
    console.log(`   DOM Content Loaded:      ${performanceMetrics.domContentLoaded}ms`);
    console.log(`   Total Load Time:         ${performanceMetrics.loadComplete}ms`);
    console.log('');
    console.log(`   Total Network Requests:  ${networkStats.totalRequests}`);
    console.log(`   Failed Requests:         ${networkStats.failed}`);
    console.log('   Requests by Type:');
    Object.entries(networkStats.byType).forEach(([type, count]) => {
      console.log(`      ${type.padEnd(20)} ${count}`);
    });
    console.log('');
    console.log(`   Console Messages:        ${consoleStats.total}`);
    if (Object.keys(consoleStats.byLevel).length > 0) {
      console.log('   By Level:');
      Object.entries(consoleStats.byLevel).forEach(([level, count]) => {
        console.log(`      ${level.padEnd(20)} ${count}`);
      });
    }
    console.log('');
    console.log(`   DOM Elements:`);
    console.log(`      Headings:             ${domSnapshot.headings.length}`);
    console.log(`      Links:                ${domSnapshot.links.length}`);
    console.log(`      Images:               ${domSnapshot.images.length}`);
    console.log(`      Forms:                ${domSnapshot.forms}`);
    console.log(`      Buttons:              ${domSnapshot.buttons}`);
    console.log('');
    console.log(`   Accessibility:`);
    console.log(`      Images without alt:   ${a11y.imagesWithoutAlt}`);
    console.log(`      Links without text:   ${a11y.linksWithoutText}`);
    console.log(`      Has main landmark:    ${a11y.hasMainLandmark ? 'Yes' : 'No'}`);
    console.log(`      Has nav landmark:     ${a11y.hasNavLandmark ? 'Yes' : 'No'}`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📄 Full report: ${reportPath}`);
    console.log(`📷 Screenshot:  ${screenshotPath}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } finally {
    await browser.close();
  }
}

performMCPStyleTest().catch(console.error);
