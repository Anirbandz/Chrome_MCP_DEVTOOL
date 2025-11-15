#!/usr/bin/env node

/**
 * Universal Performance Testing Tool
 * Usage: node perf-test.mjs <URL> [output-folder] [--cache-on|--cache-off]
 * Example: node perf-test.mjs https://example.com ./reports --cache-off
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Error: No URL provided');
  console.error('\n📖 Usage: node perf-test.mjs <URL> [output-folder] [--cache-on|--cache-off]');
  console.error('📝 Examples:');
  console.error('  node perf-test.mjs https://example.com');
  console.error('  node perf-test.mjs https://example.com ./performance-reports');
  console.error('  node perf-test.mjs https://example.com ./reports --cache-off');
  console.error('  node perf-test.mjs https://example.com ./reports --cache-on');
  process.exit(1);
}

const targetUrl = args[0];
const outputFolder = args[1] || path.join(__dirname, 'performance-reports');

// Parse cache option (default is cache OFF for fresh testing)
let cacheEnabled = false;
if (args.length > 2) {
  if (args[2] === '--cache-on') {
    cacheEnabled = true;
  } else if (args[2] === '--cache-off') {
    cacheEnabled = false;
  }
}

// Validate URL
function isValidUrl(urlString) {
  try {
    new URL(urlString);
    return true;
  } catch (e) {
    return false;
  }
}

if (!isValidUrl(targetUrl)) {
  console.error(`❌ Error: Invalid URL provided: ${targetUrl}`);
  process.exit(1);
}

// Create output folder if it doesn't exist
async function ensureOutputFolder() {
  try {
    await fs.mkdir(outputFolder, { recursive: true });
  } catch (error) {
    console.error(`❌ Error creating output folder: ${error.message}`);
    process.exit(1);
  }
}

async function runPerformanceTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 UNIVERSAL PERFORMANCE TESTING TOOL');
  console.log('='.repeat(70));
  console.log(`\n🔍 Target URL: ${targetUrl}`);
  console.log(`📁 Output Folder: ${outputFolder}`);
  console.log(`💾 Cache: ${cacheEnabled ? '✅ ON (with browser cache)' : '❌ OFF (fresh load, no cache)'}\n`);

  let browser = null;
  let page = null;

  try {
    // Ensure output folder exists
    await ensureOutputFolder();

    console.log('📡 Launching browser with real network conditions...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ Browser launched');

    console.log('📄 Creating new page...');
    page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Get CDP session for network control
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');

    // Disable or enable cache via CDP Network protocol
    if (!cacheEnabled) {
      console.log('🧹 Disabling browser cache...');
      await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    } else {
      console.log('💾 Cache enabled (using browser cache)...');
      await client.send('Network.setCacheDisabled', { cacheDisabled: false });
    }
    
    // Disable network throttling
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });

    console.log('✅ Page created with real network enabled');

    console.log(`\n🌐 Navigating to ${targetUrl}...`);
    const navStart = Date.now();
    
    let navigationFailed = false;
    let navigationError = null;

    try {
      await page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
    } catch (error) {
      navigationFailed = true;
      navigationError = error.message;
      console.warn(`⚠️  Navigation completed with warnings: ${error.message}`);
    }
    
    const navEnd = Date.now();
    console.log(`✅ Navigation completed in ${navEnd - navStart}ms`);

    // Wait for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('📊 Collecting performance metrics...');
    
    // Get performance data
    const performanceData = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const navigationTiming = performance.timing;
      const paintEntries = performance.getEntriesByType('paint');
      
      return {
        pageTitle: document.title || 'N/A',
        pageUrl: window.location.href,
        documentSize: new Blob([new XMLSerializer().serializeToString(document)]).size,
        resources: resources.map(r => ({
          name: r.name,
          initiatorType: r.initiatorType,
          duration: r.duration,
          transferSize: r.transferSize || 0,
          decodedBodySize: r.decodedBodySize || 0,
          startTime: r.startTime,
          nextHopProtocol: r.nextHopProtocol || 'http/1.1',
          responseEnd: r.responseEnd
        })),
        navigationTiming: {
          fetchStart: navigationTiming.fetchStart - navigationTiming.navigationStart,
          domainLookupStart: navigationTiming.domainLookupStart - navigationTiming.navigationStart,
          domainLookupEnd: navigationTiming.domainLookupEnd - navigationTiming.navigationStart,
          connectStart: navigationTiming.connectStart - navigationTiming.navigationStart,
          connectEnd: navigationTiming.connectEnd - navigationTiming.navigationStart,
          secureConnectionStart: navigationTiming.secureConnectionStart - navigationTiming.navigationStart,
          requestStart: navigationTiming.requestStart - navigationTiming.navigationStart,
          responseStart: navigationTiming.responseStart - navigationTiming.navigationStart,
          responseEnd: navigationTiming.responseEnd - navigationTiming.navigationStart,
          domLoading: navigationTiming.domLoading - navigationTiming.navigationStart,
          domInteractive: navigationTiming.domInteractive - navigationTiming.navigationStart,
          domContentLoadedEventStart: navigationTiming.domContentLoadedEventStart - navigationTiming.navigationStart,
          domContentLoadedEventEnd: navigationTiming.domContentLoadedEventEnd - navigationTiming.navigationStart,
          loadEventStart: navigationTiming.loadEventStart - navigationTiming.navigationStart,
          loadEventEnd: navigationTiming.loadEventEnd - navigationTiming.navigationStart
        },
        paintEntries: paintEntries.map(p => ({
          name: p.name,
          startTime: p.startTime
        })),
        elementCounts: {
          scripts: document.querySelectorAll('script').length,
          stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
          images: document.querySelectorAll('img').length,
          iframes: document.querySelectorAll('iframe').length,
          forms: document.querySelectorAll('form').length,
          links: document.querySelectorAll('a').length,
          divs: document.querySelectorAll('div').length,
          spans: document.querySelectorAll('span').length,
          buttons: document.querySelectorAll('button').length,
          inputs: document.querySelectorAll('input').length,
          tables: document.querySelectorAll('table').length,
          headers: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length
        },
        browserInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          cookieEnabled: navigator.cookieEnabled,
          online: navigator.onLine
        }
      };
    });

    console.log('✅ All metrics collected');

    // Generate Report
    console.log('\n' + '='.repeat(70));
    console.log('📋 PERFORMANCE TEST REPORT');
    console.log('='.repeat(70));

    // Page Info
    console.log('\n📄 PAGE INFORMATION:');
    console.log('─'.repeat(70));
    console.log(`  Title: ${performanceData.pageTitle}`);
    console.log(`  URL: ${performanceData.pageUrl}`);
    console.log(`  Document Size: ${(performanceData.documentSize / 1024).toFixed(2)} KB`);

    // Timing Metrics
    console.log('\n⏱️  TIMING METRICS (milliseconds):');
    console.log('─'.repeat(70));
    const timing = performanceData.navigationTiming;
    
    const dnsDuration = timing.domainLookupEnd - timing.domainLookupStart;
    const tcpDuration = timing.connectEnd - timing.connectStart;
    const tlsDuration = timing.secureConnectionStart > 0 ? timing.connectEnd - timing.secureConnectionStart : 0;
    const ttfb = timing.responseStart - timing.requestStart;
    const download = timing.responseEnd - timing.responseStart;
    const domProcessing = timing.loadEventEnd - timing.responseEnd;

    console.log(`  🌍 DNS Lookup: ${Math.round(dnsDuration)}ms`);
    if (tlsDuration > 0) {
      console.log(`  🔒 TLS Handshake: ${Math.round(tlsDuration)}ms`);
    }
    console.log(`  🔌 TCP Connection: ${Math.round(tcpDuration)}ms`);
    console.log(`  ⏲️  Time to First Byte (TTFB): ${Math.round(ttfb)}ms`);
    console.log(`  📥 Download Time: ${Math.round(download)}ms`);
    console.log(`  📝 DOM Loading Start: ${Math.round(timing.domLoading)}ms`);
    console.log(`  ✅ DOM Interactive: ${Math.round(timing.domInteractive)}ms`);
    console.log(`  📄 DOM Content Loaded: ${Math.round(timing.domContentLoadedEventEnd)}ms`);
    console.log(`  🎉 Load Event End (Finish): ${Math.round(timing.loadEventEnd)}ms`);
    console.log(`  🖼️  DOM Processing Time: ${Math.round(domProcessing)}ms`);
    
    if (performanceData.paintEntries.length > 0) {
      console.log(`\n  🎨 Paint Entries:`);
      performanceData.paintEntries.forEach(entry => {
        console.log(`    • ${entry.name}: ${Math.round(entry.startTime)}ms`);
      });
    }

    // Network & Resources
    console.log('\n📦 NETWORK & RESOURCES:');
    console.log('─'.repeat(70));
    const resources = performanceData.resources;
    const totalTransferSize = resources.reduce((sum, r) => sum + r.transferSize, 0);
    const totalDecodedSize = resources.reduce((sum, r) => sum + r.decodedBodySize, 0);
    
    console.log(`  ✅ Total Number of Requests: ${resources.length}`);
    console.log(`  📊 Total Transfer Size: ${(totalTransferSize / 1024).toFixed(2)} KB`);
    console.log(`  📊 Total Decoded Size: ${(totalDecodedSize / 1024).toFixed(2)} KB`);
    if (totalTransferSize > 0 && totalDecodedSize > 0) {
      const compressionRatio = ((totalDecodedSize - totalTransferSize) / totalDecodedSize * 100);
      if (compressionRatio > 0) {
        console.log(`  🗜️  Compression Savings: ${compressionRatio.toFixed(2)}%`);
      } else {
        console.log(`  📈 Size Increase (headers): ${Math.abs(compressionRatio).toFixed(2)}%`);
      }
    }

    // Resources by Type
    const byType = {};
    const protocolStats = {};
    resources.forEach(r => {
      if (!byType[r.initiatorType]) {
        byType[r.initiatorType] = { count: 0, size: 0, decoded: 0, time: 0 };
      }
      byType[r.initiatorType].count++;
      byType[r.initiatorType].size += r.transferSize;
      byType[r.initiatorType].decoded += r.decodedBodySize;
      byType[r.initiatorType].time += r.duration;

      const protocol = r.nextHopProtocol || 'unknown';
      if (!protocolStats[protocol]) {
        protocolStats[protocol] = { count: 0, size: 0 };
      }
      protocolStats[protocol].count++;
      protocolStats[protocol].size += r.transferSize;
    });

    console.log('\n  Resources by Type:');
    Object.entries(byType)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([type, data]) => {
        console.log(`    • ${type}: ${data.count} | ${(data.size / 1024).toFixed(2)} KB | ${Math.round(data.time)}ms`);
      });

    console.log('\n  Protocol Distribution:');
    Object.entries(protocolStats).forEach(([protocol, data]) => {
      console.log(`    • ${protocol}: ${data.count} requests | ${(data.size / 1024).toFixed(2)} KB`);
    });

    // Top resources
    console.log('\n  📌 Top 10 Resources by Transfer Size:');
    const topResources = [...resources]
      .sort((a, b) => b.transferSize - a.transferSize)
      .slice(0, 10);
    
    topResources.forEach((resource, index) => {
      const displayName = resource.name.length > 65 
        ? resource.name.substring(0, 62) + '...'
        : resource.name;
      console.log(`    ${String(index + 1).padStart(2, ' ')}. ${displayName}`);
      console.log(`        Transfer: ${resource.transferSize} B | Time: ${Math.round(resource.duration)}ms | Type: ${resource.initiatorType}`);
    });

    // Page Structure
    console.log('\n📊 PAGE STRUCTURE & ELEMENTS:');
    console.log('─'.repeat(70));
    const elements = performanceData.elementCounts;
    console.log(`  Scripts: ${elements.scripts}`);
    console.log(`  Stylesheets: ${elements.stylesheets}`);
    console.log(`  Images: ${elements.images}`);
    console.log(`  Iframes: ${elements.iframes}`);
    console.log(`  Forms: ${elements.forms}`);
    console.log(`  Links: ${elements.links}`);
    console.log(`  DIVs: ${elements.divs}`);
    console.log(`  Tables: ${elements.tables}`);
    console.log(`  Headers (H1-H6): ${elements.headers}`);
    console.log(`  Inputs: ${elements.inputs}`);
    console.log(`  Buttons: ${elements.buttons}`);

    // Summary Statistics
    console.log('\n📈 SUMMARY STATISTICS:');
    console.log('─'.repeat(70));
    const avgResourceSize = resources.length > 0 ? (totalTransferSize / resources.length) : 0;
    const avgResourceTime = resources.length > 0 ? (resources.reduce((sum, r) => sum + r.duration, 0) / resources.length) : 0;
    const minTime = resources.length > 0 ? Math.min(...resources.map(r => r.duration)) : 0;
    const maxTime = resources.length > 0 ? Math.max(...resources.map(r => r.duration)) : 0;
    
    console.log(`  Average Resource Size: ${avgResourceSize.toFixed(0)} B`);
    console.log(`  Average Resource Load Time: ${Math.round(avgResourceTime)}ms`);
    console.log(`  Fastest Resource: ${Math.round(minTime)}ms`);
    console.log(`  Slowest Resource: ${Math.round(maxTime)}ms`);
    console.log(`  Total Page Load Time: ${Math.round(timing.loadEventEnd)}ms`);
    console.log(`  Critical Path Length: ${Math.round(timing.responseEnd)}ms`);
    console.log(`  Time to First Interactive: ${Math.round(timing.domInteractive)}ms`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ PERFORMANCE TEST COMPLETED');
    console.log('='.repeat(70));

    // Generate document report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + Date.now();
    const reportFileName = `performance-report_${timestamp}.txt`;
    const reportPath = path.join(outputFolder, reportFileName);

    const reportContent = `
╔════════════════════════════════════════════════════════════════════╗
║                  PERFORMANCE TESTING REPORT                        ║
║                    Real Network Conditions                         ║
╚════════════════════════════════════════════════════════════════════╝

Generated: ${new Date().toISOString()}
Test URL: ${targetUrl}

═══════════════════════════════════════════════════════════════════════
📄 PAGE INFORMATION
═══════════════════════════════════════════════════════════════════════
Page Title: ${performanceData.pageTitle}
Page URL: ${performanceData.pageUrl}
Document Size: ${(performanceData.documentSize / 1024).toFixed(2)} KB (${performanceData.documentSize} bytes)

═══════════════════════════════════════════════════════════════════════
⏱️  TIMING METRICS (milliseconds)
═══════════════════════════════════════════════════════════════════════
DNS Lookup Duration: ${Math.round(dnsDuration)}ms
TLS Handshake: ${tlsDuration > 0 ? Math.round(tlsDuration) + 'ms' : 'N/A'}
TCP Connection Duration: ${Math.round(tcpDuration)}ms
Time to First Byte (TTFB): ${Math.round(ttfb)}ms
Download Time: ${Math.round(download)}ms
DOM Loading Start: ${Math.round(timing.domLoading)}ms
DOM Interactive: ${Math.round(timing.domInteractive)}ms
DOM Content Loaded Event: ${Math.round(timing.domContentLoadedEventEnd)}ms
Load Event End (Finish Time): ${Math.round(timing.loadEventEnd)}ms
DOM Processing Time: ${Math.round(domProcessing)}ms

Paint Events:
${performanceData.paintEntries.length > 0 
  ? performanceData.paintEntries.map(p => `  ${p.name}: ${Math.round(p.startTime)}ms`).join('\n')
  : '  No paint events recorded'}

═══════════════════════════════════════════════════════════════════════
📦 NETWORK & RESOURCES ANALYSIS
═══════════════════════════════════════════════════════════════════════
Total Number of Requests: ${resources.length}
Total Transfer Size: ${(totalTransferSize / 1024).toFixed(2)} KB (${totalTransferSize} bytes)
Total Decoded Size: ${(totalDecodedSize / 1024).toFixed(2)} KB (${totalDecodedSize} bytes)
Average Resource Size: ${avgResourceSize.toFixed(0)} bytes
Compression Efficiency: ${totalTransferSize > 0 ? ((totalDecodedSize - totalTransferSize) / totalDecodedSize * 100).toFixed(2) : '0'}%

Resource Types:
${Object.entries(byType)
  .sort((a, b) => b[1].count - a[1].count)
  .map(([type, data]) => `  ${type}: ${data.count} requests (${(data.size / 1024).toFixed(2)} KB, ${Math.round(data.time)}ms total)`)
  .join('\n')}

Protocol Distribution:
${Object.entries(protocolStats)
  .map(([protocol, data]) => `  ${protocol}: ${data.count} requests (${(data.size / 1024).toFixed(2)} KB)`)
  .join('\n')}

═══════════════════════════════════════════════════════════════════════
📋 TOP 25 RESOURCES BY SIZE
═══════════════════════════════════════════════════════════════════════
${[...resources]
  .sort((a, b) => b.transferSize - a.transferSize)
  .slice(0, 25)
  .map((r, i) => `${String(i + 1).padStart(2, ' ')}. ${r.name}
    Transfer: ${r.transferSize} B | Decoded: ${r.decodedBodySize} B | Load Time: ${Math.round(r.duration)}ms | Type: ${r.initiatorType} | Protocol: ${r.nextHopProtocol}`)
  .join('\n\n')}

═══════════════════════════════════════════════════════════════════════
📊 PAGE STRUCTURE & DOM ANALYSIS
═══════════════════════════════════════════════════════════════════════
Scripts: ${elements.scripts}
Stylesheets: ${elements.stylesheets}
Images: ${elements.images}
Iframes: ${elements.iframes}
Forms: ${elements.forms}
Links: ${elements.links}
DIVs: ${elements.divs}
SPANs: ${elements.spans}
Tables: ${elements.tables}
Headers (H1-H6): ${elements.headers}
Input Fields: ${elements.inputs}
Buttons: ${elements.buttons}

═══════════════════════════════════════════════════════════════════════
📈 PERFORMANCE SUMMARY & KEY INSIGHTS
═══════════════════════════════════════════════════════════════════════
Fastest Resource: ${Math.round(minTime)}ms
Slowest Resource: ${Math.round(maxTime)}ms
Average Resource Load: ${Math.round(avgResourceTime)}ms
Critical Path Length: ${Math.round(timing.responseEnd)}ms
Total Page Load Time: ${Math.round(timing.loadEventEnd)}ms
Time to First Interactive: ${Math.round(timing.domInteractive)}ms
Time to First Paint: ${performanceData.paintEntries[0]?.startTime ? Math.round(performanceData.paintEntries[0].startTime) : 'N/A'}ms

═══════════════════════════════════════════════════════════════════════
🌐 BROWSER & CONNECTIVITY INFO
═══════════════════════════════════════════════════════════════════════
Cookie Enabled: ${performanceData.browserInfo.cookieEnabled}
Online Status: ${performanceData.browserInfo.online}
Language: ${performanceData.browserInfo.language}
User Agent: ${performanceData.browserInfo.userAgent}

═══════════════════════════════════════════════════════════════════════
📝 TEST METADATA
═══════════════════════════════════════════════════════════════════════
Navigation Failed: ${navigationFailed}
${navigationFailed ? `Navigation Error: ${navigationError}` : ''}
Test Duration: ${navEnd - navStart}ms
Test Conditions: Real Network (Unthrottled)
Cache Mode: ${cacheEnabled ? 'ON (with browser cache)' : 'OFF (fresh load, cache disabled)'}
Protocol Version: HTTP/2 Capable

═══════════════════════════════════════════════════════════════════════
End of Report
═══════════════════════════════════════════════════════════════════════
`;

    await fs.writeFile(reportPath, reportContent);
    console.log(`\n📄 Full report saved to: ${reportPath}`);

    // Also generate a JSON report for data analysis
    const jsonReportName = `performance-report_${timestamp}.json`;
    const jsonReportPath = path.join(outputFolder, jsonReportName);
    
    const jsonReport = {
      metadata: {
        testUrl: targetUrl,
        generatedAt: new Date().toISOString(),
        navigationDuration: navEnd - navStart,
        navigationFailed: navigationFailed,
        cacheEnabled: cacheEnabled,
        cacheMode: cacheEnabled ? 'with-cache (browser cache enabled)' : 'no-cache (fresh load, cache disabled)'
      },
      timingMetrics: {
        dnsDuration: Math.round(dnsDuration),
        tcpDuration: Math.round(tcpDuration),
        tlsDuration: Math.round(tlsDuration),
        ttfb: Math.round(ttfb),
        downloadTime: Math.round(download),
        domInteractive: Math.round(timing.domInteractive),
        domContentLoaded: Math.round(timing.domContentLoadedEventEnd),
        pageLoadTime: Math.round(timing.loadEventEnd),
        domProcessingTime: Math.round(domProcessing),
        criticalPath: Math.round(timing.responseEnd)
      },
      networkMetrics: {
        totalRequests: resources.length,
        totalTransferSize: totalTransferSize,
        totalTransferSizeKb: (totalTransferSize / 1024).toFixed(2),
        totalDecodedSize: totalDecodedSize,
        totalDecodedSizeKb: (totalDecodedSize / 1024).toFixed(2),
        averageResourceSize: avgResourceSize.toFixed(0),
        compressionEfficiency: totalTransferSize > 0 ? ((totalDecodedSize - totalTransferSize) / totalDecodedSize * 100).toFixed(2) : '0'
      },
      resourcesByType: byType,
      protocolDistribution: protocolStats,
      topResources: topResources.map(r => ({
        name: r.name,
        transferSize: r.transferSize,
        decodedBodySize: r.decodedBodySize,
        duration: Math.round(r.duration),
        type: r.initiatorType,
        protocol: r.nextHopProtocol
      })),
      pageStructure: elements,
      pagePerformanceSummary: {
        fastestResource: Math.round(minTime),
        slowestResource: Math.round(maxTime),
        averageResourceTime: Math.round(avgResourceTime),
        timeToFirstInteractive: Math.round(timing.domInteractive)
      }
    };

    await fs.writeFile(jsonReportPath, JSON.stringify(jsonReport, null, 2));
    console.log(`📊 JSON report saved to: ${jsonReportPath}`);
    console.log(`\n✨ All reports generated successfully in: ${outputFolder}\n`);

  } catch (error) {
    console.error('\n❌ Error during testing:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

// Run the test
runPerformanceTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
