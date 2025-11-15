#!/usr/bin/env node
/**
 * Comprehensive performance analysis script
 * Collects detailed metrics including network requests, timings, resources, and more
 * 
 * Usage: node detailed-perf-analysis.mjs <URL>
 * Example: node detailed-perf-analysis.mjs https://example.com
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Get URL from command line argument
const TARGET_URL = process.argv[2];

if (!TARGET_URL) {
  console.error('❌ Error: Please provide a URL as an argument');
  console.error('Usage: node detailed-perf-analysis.mjs <URL>');
  console.error('Example: node detailed-perf-analysis.mjs https://example.com');
  process.exit(1);
}

// Validate URL format
try {
  new URL(TARGET_URL);
} catch (error) {
  console.error('❌ Error: Invalid URL format');
  console.error('Please provide a valid URL starting with http:// or https://');
  process.exit(1);
}

async function performDetailedAnalysis() {
  console.log('🚀 Starting comprehensive performance analysis...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Enable necessary domains
    const client = await page.createCDPSession();
    await client.send('Network.enable');
    await client.send('Performance.enable');
    await client.send('Page.enable');

    // Collectors for network data
    const networkRequests = [];
    const resourceTimings = [];
    let domContentLoadedTime = null;
    let loadEventTime = null;

    // Network request tracking
    client.on('Network.requestWillBeSent', (params) => {
      networkRequests.push({
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
        resourceType: params.type,
        timestamp: params.timestamp,
        initiator: params.initiator?.type || 'unknown'
      });
    });

    client.on('Network.responseReceived', (params) => {
      const request = networkRequests.find(r => r.requestId === params.requestId);
      if (request) {
        request.status = params.response.status;
        request.mimeType = params.response.mimeType;
        request.headers = params.response.headers;
        request.responseTime = params.timestamp;
        request.fromCache = params.response.fromDiskCache || params.response.fromServiceWorker;
      }
    });

    client.on('Network.loadingFinished', (params) => {
      const request = networkRequests.find(r => r.requestId === params.requestId);
      if (request) {
        request.encodedDataLength = params.encodedDataLength;
        request.finishTime = params.timestamp;
      }
    });

    client.on('Network.loadingFailed', (params) => {
      const request = networkRequests.find(r => r.requestId === params.requestId);
      if (request) {
        request.failed = true;
        request.errorText = params.errorText;
      }
    });

    // Page timing events
    client.on('Page.domContentEventFired', (params) => {
      domContentLoadedTime = params.timestamp;
    });

    client.on('Page.loadEventFired', (params) => {
      loadEventTime = params.timestamp;
    });

    console.log(`📍 Navigating to: ${TARGET_URL}\n`);
    
    const navigationStart = Date.now();
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait a bit more to ensure all resources are captured
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get performance metrics from browser
    const performanceMetrics = await client.send('Performance.getMetrics');
    
    // Get navigation timing from page
    const navigationTiming = await page.evaluate(() => {
      const timing = performance.timing;
      const navigation = performance.getEntriesByType('navigation')[0];
      
      return {
        // Navigation Timing API Level 1
        navigationStart: timing.navigationStart,
        unloadEventStart: timing.unloadEventStart,
        unloadEventEnd: timing.unloadEventEnd,
        redirectStart: timing.redirectStart,
        redirectEnd: timing.redirectEnd,
        fetchStart: timing.fetchStart,
        domainLookupStart: timing.domainLookupStart,
        domainLookupEnd: timing.domainLookupEnd,
        connectStart: timing.connectStart,
        connectEnd: timing.connectEnd,
        secureConnectionStart: timing.secureConnectionStart,
        requestStart: timing.requestStart,
        responseStart: timing.responseStart,
        responseEnd: timing.responseEnd,
        domLoading: timing.domLoading,
        domInteractive: timing.domInteractive,
        domContentLoadedEventStart: timing.domContentLoadedEventStart,
        domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
        domComplete: timing.domComplete,
        loadEventStart: timing.loadEventStart,
        loadEventEnd: timing.loadEventEnd,
        
        // Navigation Timing API Level 2 (if available)
        ...(navigation && {
          transferSize: navigation.transferSize,
          encodedBodySize: navigation.encodedBodySize,
          decodedBodySize: navigation.decodedBodySize,
          duration: navigation.duration
        })
      };
    });

    // Get resource timing
    const resourcePerformance = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map(resource => ({
        name: resource.name,
        initiatorType: resource.initiatorType,
        duration: resource.duration,
        transferSize: resource.transferSize,
        encodedBodySize: resource.encodedBodySize,
        decodedBodySize: resource.decodedBodySize,
        startTime: resource.startTime,
        fetchStart: resource.fetchStart,
        domainLookupStart: resource.domainLookupStart,
        domainLookupEnd: resource.domainLookupEnd,
        connectStart: resource.connectStart,
        connectEnd: resource.connectEnd,
        requestStart: resource.requestStart,
        responseStart: resource.responseStart,
        responseEnd: resource.responseEnd
      }));
    });

    // Calculate derived metrics
    const calculateTimings = (timing) => {
      const base = timing.navigationStart;
      return {
        redirectTime: timing.redirectEnd - timing.redirectStart,
        dnsTime: timing.domainLookupEnd - timing.domainLookupStart,
        tcpTime: timing.connectEnd - timing.connectStart,
        requestTime: timing.responseStart - timing.requestStart,
        responseTime: timing.responseEnd - timing.responseStart,
        domProcessingTime: timing.domComplete - timing.domLoading,
        domContentLoadedTime: timing.domContentLoadedEventStart - base,
        loadTime: timing.loadEventStart - base,
        totalTime: timing.loadEventEnd - base
      };
    };

    const timings = calculateTimings(navigationTiming);

    // Aggregate network statistics
    const networkStats = {
      totalRequests: networkRequests.length,
      failedRequests: networkRequests.filter(r => r.failed).length,
      cachedRequests: networkRequests.filter(r => r.fromCache).length,
      totalTransferSize: networkRequests.reduce((sum, r) => sum + (r.encodedDataLength || 0), 0),
      requestsByType: {},
      requestsByDomain: {}
    };

    // Group by resource type
    networkRequests.forEach(req => {
      const type = req.resourceType || 'other';
      if (!networkStats.requestsByType[type]) {
        networkStats.requestsByType[type] = { count: 0, size: 0 };
      }
      networkStats.requestsByType[type].count++;
      networkStats.requestsByType[type].size += req.encodedDataLength || 0;

      // Group by domain
      try {
        const domain = new URL(req.url).hostname;
        if (!networkStats.requestsByDomain[domain]) {
          networkStats.requestsByDomain[domain] = { count: 0, size: 0 };
        }
        networkStats.requestsByDomain[domain].count++;
        networkStats.requestsByDomain[domain].size += req.encodedDataLength || 0;
      } catch (e) {
        // Invalid URL
      }
    });

    // Compile the full report
    const report = {
      url: TARGET_URL,
      timestamp: new Date().toISOString(),
      summary: {
        totalRequests: networkStats.totalRequests,
        failedRequests: networkStats.failedRequests,
        cachedRequests: networkStats.cachedRequests,
        totalTransferSize: formatBytes(networkStats.totalTransferSize),
        totalTransferSizeBytes: networkStats.totalTransferSize,
        domContentLoadedTime: `${timings.domContentLoadedTime.toFixed(2)} ms`,
        loadTime: `${timings.loadTime.toFixed(2)} ms`,
        totalTime: `${timings.totalTime.toFixed(2)} ms`
      },
      detailedTimings: {
        redirectTime: `${timings.redirectTime.toFixed(2)} ms`,
        dnsLookupTime: `${timings.dnsTime.toFixed(2)} ms`,
        tcpConnectionTime: `${timings.tcpTime.toFixed(2)} ms`,
        requestTime: `${timings.requestTime.toFixed(2)} ms`,
        responseTime: `${timings.responseTime.toFixed(2)} ms`,
        domProcessingTime: `${timings.domProcessingTime.toFixed(2)} ms`
      },
      resourceBreakdown: networkStats.requestsByType,
      domainBreakdown: networkStats.requestsByDomain,
      navigationTiming: navigationTiming,
      performanceMetrics: performanceMetrics.metrics,
      resources: resourcePerformance,
      networkRequests: networkRequests
    };

    // Save the detailed report
    const timestamp = Date.now();
    const urlSlug = new URL(TARGET_URL).hostname.replace(/\./g, '_');
    const reportPath = path.join(process.cwd(), 'performance-reports', `${urlSlug}-performance-${timestamp}.json`);
    
    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary to console
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PERFORMANCE ANALYSIS SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🌐 URL:', TARGET_URL);
    console.log('📅 Timestamp:', new Date().toLocaleString());
    console.log('');
    
    console.log('📈 KEY METRICS FOR APP TEAM:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total Requests:           ${networkStats.totalRequests}`);
    console.log(`   Failed Requests:          ${networkStats.failedRequests}`);
    console.log(`   Cached Requests:          ${networkStats.cachedRequests}`);
    console.log(`   Total Transfer Size:      ${formatBytes(networkStats.totalTransferSize)}`);
    console.log('');
    console.log('⏱️  TIMING METRICS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   DNS Lookup:               ${timings.dnsTime.toFixed(2)} ms`);
    console.log(`   TCP Connection:           ${timings.tcpTime.toFixed(2)} ms`);
    console.log(`   Request Time:             ${timings.requestTime.toFixed(2)} ms`);
    console.log(`   Response Time:            ${timings.responseTime.toFixed(2)} ms`);
    console.log(`   DOM Processing:           ${timings.domProcessingTime.toFixed(2)} ms`);
    console.log(`   DOM Content Loaded:       ${timings.domContentLoadedTime.toFixed(2)} ms`);
    console.log(`   Load Event:               ${timings.loadTime.toFixed(2)} ms`);
    console.log(`   Total Page Load:          ${timings.totalTime.toFixed(2)} ms`);
    console.log('');
    
    console.log('📦 RESOURCE BREAKDOWN:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Object.entries(networkStats.requestsByType)
      .sort((a, b) => b[1].size - a[1].size)
      .forEach(([type, stats]) => {
        console.log(`   ${type.padEnd(20)} ${stats.count.toString().padStart(4)} requests  ${formatBytes(stats.size).padStart(12)}`);
      });
    console.log('');
    
    console.log('🌍 DOMAIN BREAKDOWN:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Object.entries(networkStats.requestsByDomain)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 10)
      .forEach(([domain, stats]) => {
        const shortDomain = domain.length > 40 ? domain.substring(0, 37) + '...' : domain;
        console.log(`   ${shortDomain.padEnd(40)} ${stats.count.toString().padStart(4)} requests  ${formatBytes(stats.size).padStart(12)}`);
      });
    console.log('');
    
    console.log('💡 RECOMMENDATIONS FOR APP TEAM:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Generate recommendations
    const recommendations = [];
    
    if (networkStats.totalRequests > 50) {
      recommendations.push(`⚠️  High request count (${networkStats.totalRequests}). Consider combining resources or using HTTP/2.`);
    }
    
    if (networkStats.totalTransferSize > 2 * 1024 * 1024) {
      recommendations.push(`⚠️  Large total transfer size (${formatBytes(networkStats.totalTransferSize)}). Implement compression and minification.`);
    }
    
    if (timings.domContentLoadedTime > 1500) {
      recommendations.push(`⚠️  Slow DOM Content Loaded (${timings.domContentLoadedTime.toFixed(0)} ms). Optimize critical rendering path.`);
    }
    
    if (timings.loadTime > 3000) {
      recommendations.push(`⚠️  Slow page load time (${timings.loadTime.toFixed(0)} ms). Consider lazy loading and code splitting.`);
    }
    
    if (networkStats.failedRequests > 0) {
      recommendations.push(`❌  ${networkStats.failedRequests} failed request(s). Investigate and fix broken resources.`);
    }
    
    const imageStats = networkStats.requestsByType['Image'] || { size: 0 };
    if (imageStats.size > 1024 * 1024) {
      recommendations.push(`🖼️  Large image payload (${formatBytes(imageStats.size)}). Optimize images and use modern formats (WebP).`);
    }
    
    const scriptStats = networkStats.requestsByType['Script'] || { size: 0 };
    if (scriptStats.size > 500 * 1024) {
      recommendations.push(`📜  Large JavaScript payload (${formatBytes(scriptStats.size)}). Consider code splitting and tree shaking.`);
    }
    
    if (recommendations.length === 0) {
      console.log('   ✅ Performance looks good! No major issues detected.');
    } else {
      recommendations.forEach(rec => console.log(`   ${rec}`));
    }
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📄 Full report saved to: ${reportPath}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return report;

  } finally {
    await browser.close();
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the analysis
performDetailedAnalysis().catch(console.error);
