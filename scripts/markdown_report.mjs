import fs from 'fs/promises';
import path from 'path';

async function generateReport(reportPath) {
    const reportData = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
    
    let report = '# Performance Test Report\n\n';
    report += `Generated on: ${new Date().toLocaleString()}\n\n`;
    
    for (const entry of reportData) {
        report += `## Step: ${entry.step}\n\n`;
        
        try {
            const metrics = JSON.parse(await fs.readFile(entry.metricsPath, 'utf-8'));
            
            report += '### Core Web Vitals\n\n';
            report += `- LCP: ${metrics.lcp?.duration ? (metrics.lcp.duration/1000).toFixed(2) + 's' : 'N/A'}\n`;
            report += `- CLS: ${metrics.cls?.toFixed(3) || 'N/A'}\n`;
            report += `- INP: ${metrics.inp?.toFixed(2) || 'N/A'}ms\n`;
            
            if (metrics.navigationTiming) {
                const ttfb = metrics.navigationTiming.responseStart - metrics.navigationTiming.requestStart;
                report += `- TTFB: ${ttfb.toFixed(2)}ms\n`;
            }
            
            if (metrics.longTasks?.length > 0) {
                const tbt = metrics.longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
                report += `- Total Blocking Time: ${tbt.toFixed(2)}ms\n`;
                report += `- Long Tasks Count: ${metrics.longTasks.length}\n`;
            }
            
            report += '\n### Performance Analysis\n\n';
            
            // Analyze LCP
            if (metrics.lcp?.duration > 2500) {
                report += '⚠️ **High LCP detected**\n';
                report += '- Consider optimizing server response time\n';
                report += '- Implement resource prioritization\n';
                report += '- Optimize critical rendering path\n';
            }
            
            // Analyze CLS
            if (metrics.cls > 0.1) {
                report += '⚠️ **High CLS detected**\n';
                report += '- Set explicit dimensions for images and media\n';
                report += '- Reserve space for dynamic content\n';
                report += '- Avoid inserting content above existing content\n';
            }
            
            // Analyze Long Tasks
            if (metrics.longTasks?.length > 0) {
                const tbt = metrics.longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
                if (tbt > 200) {
                    report += '⚠️ **High Total Blocking Time**\n';
                    report += '- Break up long tasks\n';
                    report += '- Defer non-critical JavaScript\n';
                    report += '- Consider using web workers for heavy computations\n';
                }
            }
            
        } catch (e) {
            report += `Error reading metrics: ${e.message}\n`;
        }
        
        report += '\n---\n\n';
    }
    
    report += '## Overall Recommendations\n\n';
    report += '### High Priority\n';
    report += '- Optimize server response time for faster TTFB\n';
    report += '- Implement resource prioritization for critical assets\n';
    report += '- Optimize and compress static assets\n\n';
    
    report += '### Medium Priority\n';
    report += '- Implement lazy loading for below-the-fold content\n';
    report += '- Add resource hints for critical resources\n';
    report += '- Optimize JavaScript execution\n\n';
    
    report += '### Low Priority\n';
    report += '- Implement service worker for caching\n';
    report += '- Consider using modern image formats\n';
    report += '- Add compression for text-based resources\n';

    const outputPath = path.join(process.cwd(), 'performance_report.md');
    await fs.writeFile(outputPath, report);
    
    console.log(`Report generated: ${outputPath}`);
}

// Check if report path is provided
const reportPath = process.argv[2];
if (!reportPath) {
    console.error('Please provide the path to the performance report JSON file');
    process.exit(1);
}

generateReport(reportPath).catch(console.error);