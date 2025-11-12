import { Document, Paragraph, Table, TableRow, TableCell, Media, HeadingLevel, AlignmentType, TextRun, SectionType, PageOrientation, BorderStyle } from 'docx';
import { createCanvas } from 'canvas';
import Chart from 'chart.js/auto';
import fs from 'fs/promises';
import path from 'path';

const SEVERITY = {
    HIGH: { text: 'High', color: 'FF0000' },
    MEDIUM: { text: 'Medium', color: 'FFA500' },
    LOW: { text: 'Low', color: '008000' }
};

function createSeverityParagraph(severity) {
    return new Paragraph({
        children: [
            new TextRun({
                text: severity.text,
                color: severity.color,
                bold: true
            })
        ]
    });
}

async function analyzeTraceMetrics(metrics) {
    const issues = [];
    
    // Analyze LCP
    const lcp = metrics.lcp?.duration || 0;
    if (lcp > 2500) {
        issues.push({
            severity: SEVERITY.HIGH,
            issue: `High Largest Contentful Paint (${(lcp/1000).toFixed(2)}s)`,
            impact: 'Poor user experience due to slow content rendering',
            recommendation: 'Optimize critical rendering path, reduce server response time, optimize images'
        });
    }

    // Analyze CLS
    const cls = metrics.cls || 0;
    if (cls > 0.1) {
        issues.push({
            severity: SEVERITY.HIGH,
            issue: `High Cumulative Layout Shift (${cls.toFixed(3)})`,
            impact: 'Poor user experience due to unexpected layout shifts',
            recommendation: 'Set explicit dimensions for images/media, reserve space for dynamic content'
        });
    }

    // Analyze Long Tasks
    const longTasks = metrics.longTasks || [];
    if (longTasks.length > 0) {
        const totalBlockingTime = longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
        if (totalBlockingTime > 200) {
            issues.push({
                severity: SEVERITY.MEDIUM,
                issue: `High Total Blocking Time (${totalBlockingTime.toFixed(2)}ms)`,
                impact: 'Poor interactivity due to long-running JavaScript tasks',
                recommendation: 'Split long tasks, optimize JavaScript execution, use web workers for heavy computations'
            });
        }
    }

    // Analyze Resource Loading
    const resources = metrics.resources || [];
    const largeResources = resources.filter(r => r.transferSize > 200000);
    if (largeResources.length > 0) {
        issues.push({
            severity: SEVERITY.MEDIUM,
            issue: `${largeResources.length} large resources detected`,
            impact: 'Slower page load times and increased bandwidth usage',
            recommendation: 'Optimize and compress large resources, implement lazy loading, use modern image formats'
        });
    }

    return issues;
}

async function createPerformanceChart(metrics, steps) {
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: steps,
            datasets: [
                {
                    label: 'LCP (ms)',
                    data: metrics.map(m => m.metrics?.lcp?.duration || 0),
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                },
                {
                    label: 'TTFB (ms)',
                    data: metrics.map(m => m.metrics?.navigationTiming?.responseStart - m.metrics?.navigationTiming?.requestStart || 0),
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                },
                {
                    label: 'TBT (ms)',
                    data: metrics.map(m => {
                        const longTasks = m.metrics?.longTasks || [];
                        return longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
                    }),
                    backgroundColor: 'rgba(255, 206, 86, 0.5)',
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Time (milliseconds)'
                    }
                }
            }
        }
    });
    
    const buffer = canvas.toBuffer('image/png');
    const chartPath = path.join(process.cwd(), 'performance_chart.png');
    await fs.writeFile(chartPath, buffer);
    
    return chartPath;
}

async function generateReport(reportPath) {
    const reportData = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
    
    // Analyze each step
    const analysisPromises = reportData.map(async entry => ({
        step: entry.step,
        metrics: JSON.parse(await fs.readFile(entry.metricsPath, 'utf-8')),
        issues: await analyzeTraceMetrics(JSON.parse(await fs.readFile(entry.metricsPath, 'utf-8')))
    }));
    
    const analyses = await Promise.all(analysisPromises);
    
    // Create performance chart
    const perfChartPath = await createPerformanceChart(analyses, analyses.map(a => a.step));
    
    // Create Word document
    const doc = new Document({ sections: [] });
    const sectionChildren = [
        new Paragraph({
            text: 'Performance Test Report',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER
        }),
        new Paragraph({
            text: new Date().toLocaleDateString(),
            alignment: AlignmentType.CENTER
        }),
        new Paragraph({
            text: 'Core Web Vitals Summary',
            heading: HeadingLevel.HEADING_2
        }),
        // Chart image (skipped due to environment Media API differences)
        
        // Add detailed metrics table
        new Paragraph({
            text: 'Detailed Performance Metrics',
            heading: HeadingLevel.HEADING_2
        }),
        new Table({
            rows: [
                new TableRow({
                    children: [
                        new TableCell({ text: 'Step' }),
                        new TableCell({ text: 'LCP (ms)' }),
                        new TableCell({ text: 'CLS' }),
                        new TableCell({ text: 'INP (ms)' }),
                        new TableCell({ text: 'TTFB (ms)' }),
                        new TableCell({ text: 'TBT (ms)' })
                    ]
                }),
                ...analyses.map(analysis => new TableRow({
                    children: [
                        new TableCell({ text: analysis.step }),
                        new TableCell({ text: (analysis.metrics?.lcp?.duration || 'N/A').toString() }),
                        new TableCell({ text: (analysis.metrics?.cls || 'N/A').toString() }),
                        new TableCell({ text: (analysis.metrics?.inp || 'N/A').toString() }),
                        new TableCell({ text: ((analysis.metrics?.navigationTiming?.responseStart - analysis.metrics?.navigationTiming?.requestStart) || 'N/A').toString() }),
                        new TableCell({ text: (analysis.metrics?.longTasks?.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0) || 'N/A').toString() })
                    ]
                }))
            ]
        }),

        // Issues and Recommendations
        new Paragraph({
            text: 'Performance Issues and Recommendations',
            heading: HeadingLevel.HEADING_2,
            spacing: {
                before: 400
            }
        })
    ];
    doc.addSection({
        properties: {
            type: SectionType.CONTINUOUS,
            page: {
                orientation: PageOrientation.LANDSCAPE
            }
        },
        children: sectionChildren
    });

    // Add issues for each step
    for (const analysis of analyses) {
        if (analysis.issues.length > 0) {
            doc.addSection({
                children: [
                    new Paragraph({
                        text: `${analysis.step} - Issues Found`,
                        heading: HeadingLevel.HEADING_3
                    }),
                    ...analysis.issues.map(issue => [
                        createSeverityParagraph(issue.severity),
                        new Paragraph({ text: `Issue: ${issue.issue}` }),
                        new Paragraph({ text: `Impact: ${issue.impact}` }),
                        new Paragraph({
                            text: `Recommendation: ${issue.recommendation}`,
                            spacing: { after: 200 }
                        })
                    ]).flat()
                ]
            });
        }
    }

    // Save document
    const docBuffer = await doc.save();
    const outputPath = path.join(process.cwd(), 'performance_report.docx');
    await fs.writeFile(outputPath, docBuffer);
    
    // Clean up chart image
    await fs.unlink(perfChartPath);
    
    console.log(`Report generated: ${outputPath}`);
}

// Check if report path is provided
const reportPath = process.argv[2];
if (!reportPath) {
    console.error('Please provide the path to the performance report JSON file');
    process.exit(1);
}

generateReport(reportPath).catch(console.error);