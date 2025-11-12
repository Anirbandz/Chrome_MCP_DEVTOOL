import { Document, Paragraph, Table, TableRow, TableCell, Media, HeadingLevel, AlignmentType } from 'docx';
import { createCanvas } from 'canvas';
import Chart from 'chart.js/auto';
import fs from 'fs/promises';
import path from 'path';

async function parseTraceMetrics(tracePath) {
    const traceData = JSON.parse(await fs.readFile(tracePath, 'utf-8'));
    
    // Extract key metrics from trace events
    const navigationStart = traceData.find(e => e.name === 'navigationStart')?.ts;
    const loadEventEnd = traceData.find(e => e.name === 'loadEventEnd')?.ts;
    const firstPaint = traceData.find(e => e.name === 'firstPaint')?.ts;
    const firstContentfulPaint = traceData.find(e => e.name === 'firstContentfulPaint')?.ts;
    
    // Calculate timing in milliseconds
    const loadTime = loadEventEnd && navigationStart ? (loadEventEnd - navigationStart) / 1000 : null;
    const fcp = firstContentfulPaint && navigationStart ? (firstContentfulPaint - navigationStart) / 1000 : null;
    const fp = firstPaint && navigationStart ? (firstPaint - navigationStart) / 1000 : null;
    
    // Network metrics
    const networkRequests = traceData.filter(e => e.name === 'ResourceSendRequest').length;
    const networkBytes = traceData
        .filter(e => e.name === 'ResourceReceiveResponse')
        .reduce((sum, e) => sum + (e.args?.data?.encodedDataLength || 0), 0);

    return {
        loadTime,
        firstPaint: fp,
        firstContentfulPaint: fcp,
        networkRequests,
        networkBytes: networkBytes / 1024 / 1024 // Convert to MB
    };
}

async function createPerformanceChart(metrics, steps) {
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: steps,
            datasets: [{
                label: 'Page Load Time (ms)',
                data: metrics.map(m => m.loadTime),
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }, {
                label: 'First Paint (ms)',
                data: metrics.map(m => m.firstPaint),
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
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
    
    // Save chart as image
    const buffer = canvas.toBuffer('image/png');
    const chartPath = path.join(process.cwd(), 'performance_chart.png');
    await fs.writeFile(chartPath, buffer);
    
    return chartPath;
}

async function createNetworkChart(metrics, steps) {
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: steps,
            datasets: [{
                label: 'Network Requests',
                data: metrics.map(m => m.networkRequests),
                borderColor: 'rgba(75, 192, 192, 1)',
                tension: 0.1,
                yAxisID: 'requests'
            }, {
                label: 'Data Transferred (MB)',
                data: metrics.map(m => m.networkBytes),
                borderColor: 'rgba(153, 102, 255, 1)',
                tension: 0.1,
                yAxisID: 'bytes'
            }]
        },
        options: {
            responsive: true,
            scales: {
                requests: {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Number of Requests'
                    }
                },
                bytes: {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Data Transferred (MB)'
                    }
                }
            }
        }
    });
    
    // Save chart as image
    const buffer = canvas.toBuffer('image/png');
    const chartPath = path.join(process.cwd(), 'network_chart.png');
    await fs.writeFile(chartPath, buffer);
    
    return chartPath;
}

async function generateReport(reportPath) {
    // Read the performance report
    const reportData = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
    
    // Parse metrics for each step
    const metrics = [];
    const steps = [];
    
    for (const entry of reportData) {
        steps.push(entry.step);
        const traceMetrics = await parseTraceMetrics(entry.path);
        metrics.push(traceMetrics);
    }
    
    // Create charts
    const perfChartPath = await createPerformanceChart(metrics, steps);
    const networkChartPath = await createNetworkChart(metrics, steps);
    
    // Create Word document
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
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
                    text: 'Performance Metrics Overview',
                    heading: HeadingLevel.HEADING_2
                }),
                await Media.addImage(doc, await fs.readFile(perfChartPath), 600, 300),
                new Paragraph({
                    text: 'Network Metrics Overview',
                    heading: HeadingLevel.HEADING_2
                }),
                await Media.addImage(doc, await fs.readFile(networkChartPath), 600, 300),
                new Paragraph({
                    text: 'Detailed Metrics by Step',
                    heading: HeadingLevel.HEADING_2
                }),
                new Table({
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ text: 'Step' }),
                                new TableCell({ text: 'Load Time (ms)' }),
                                new TableCell({ text: 'First Paint (ms)' }),
                                new TableCell({ text: 'FCP (ms)' }),
                                new TableCell({ text: 'Requests' }),
                                new TableCell({ text: 'Data (MB)' })
                            ]
                        }),
                        ...steps.map((step, i) => new TableRow({
                            children: [
                                new TableCell({ text: step }),
                                new TableCell({ text: metrics[i].loadTime?.toFixed(2) || 'N/A' }),
                                new TableCell({ text: metrics[i].firstPaint?.toFixed(2) || 'N/A' }),
                                new TableCell({ text: metrics[i].firstContentfulPaint?.toFixed(2) || 'N/A' }),
                                new TableCell({ text: metrics[i].networkRequests.toString() }),
                                new TableCell({ text: metrics[i].networkBytes.toFixed(2) })
                            ]
                        }))
                    ]
                })
            ]
        }]
    });
    
    // Save document
    const docBuffer = await doc.save();
    const outputPath = path.join(process.cwd(), 'performance_report.docx');
    await fs.writeFile(outputPath, docBuffer);
    
    // Clean up chart images
    await fs.unlink(perfChartPath);
    await fs.unlink(networkChartPath);
    
    console.log(`Report generated: ${outputPath}`);
}

// Check if report path is provided
const reportPath = process.argv[2];
if (!reportPath) {
    console.error('Please provide the path to the performance report JSON file');
    process.exit(1);
}

generateReport(reportPath).catch(console.error);