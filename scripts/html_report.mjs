import fs from 'fs/promises';
import path from 'path';

async function generateHtmlReport(reportPath) {
    const reportData = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        h2 { color: #666; margin-top: 30px; }
        .metric { margin: 10px 0; padding: 10px; background: #f5f5f5; }
        .high { color: #d32f2f; }
        .medium { color: #f57c00; }
        .low { color: #388e3c; }
    </style>
</head>
<body>
    <h1>Performance Test Report</h1>
    <p>Generated on: ${new Date().toLocaleString()}</p>

    ${await Promise.all(reportData.map(async entry => {
        const metrics = await fs.readFile(entry.metricsPath, 'utf-8')
            .then(JSON.parse)
            .catch(() => ({ error: 'Could not read metrics' }));
        
        // Calculate key metrics
        const lcp = metrics.lcp?.duration;
        const cls = metrics.cls;
        const inp = metrics.inp;
        const ttfb = metrics.navigationTiming ? 
            metrics.navigationTiming.responseStart - metrics.navigationTiming.requestStart :
            null;
        const longTasks = metrics.longTasks || [];
        const tbt = longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
        
        return `
        <h2>Step: ${entry.step}</h2>
        <div class="metric">
            <strong>Core Web Vitals:</strong><br>
            LCP: ${lcp ? (lcp/1000).toFixed(2) + 's' : 'N/A'} ${lcp > 2500 ? '⚠️' : '✅'}<br>
            CLS: ${cls?.toFixed(3) || 'N/A'} ${cls > 0.1 ? '⚠️' : '✅'}<br>
            INP: ${inp?.toFixed(2) || 'N/A'}ms<br>
            TTFB: ${ttfb?.toFixed(2) || 'N/A'}ms ${ttfb > 600 ? '⚠️' : '✅'}<br>
            TBT: ${tbt.toFixed(2)}ms ${tbt > 200 ? '⚠️' : '✅'}
        </div>
        <div class="metric">
            <strong>Long Tasks:</strong><br>
            Count: ${longTasks.length}<br>
            Total Blocking Time: ${tbt.toFixed(2)}ms
        </div>
        `;
    })).join('\n')}

    <h2>Performance Summary</h2>
    <div class="metric">
        ${reportData.map(entry => `
            <strong>${entry.step}:</strong> ${entry.path}<br>
        `).join('\n')}
    </div>

    <h2>Recommendations</h2>
    <ul>
        <li class="high">Optimize LCP by reducing server response time and optimizing critical rendering path</li>
        <li class="medium">Minimize long tasks by splitting JavaScript execution and using web workers where possible</li>
        <li class="medium">Implement resource hints (preconnect, preload) for critical resources</li>
        <li class="low">Consider implementing lazy loading for below-the-fold content</li>
    </ul>
</body>
</html>`;

    const outputPath = path.join(process.cwd(), 'performance_report.html');
    await fs.writeFile(outputPath, html);
    
    console.log(`Report generated: ${outputPath}`);
}

// Check if report path is provided
const reportPath = process.argv[2];
if (!reportPath) {
    console.error('Please provide the path to the performance report JSON file');
    process.exit(1);
}

generateHtmlReport(reportPath).catch(console.error);